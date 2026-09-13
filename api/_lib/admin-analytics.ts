import { query, transaction } from "./db.js";
import { HttpError } from "./http.js";
import { uuid } from "./admin-questions.js";
// Browser IDs are a convenience for comparing visits, never evidence of a person's identity.
const owner = `COALESCE('user:'||g.user_id::text,'guest:'||md5(g.guest_session_hash))`;
const excludedRun = `EXISTS(SELECT 1 FROM admin_exclusions x WHERE x.subject=${owner} OR x.subject='session:'||g.id::text OR EXISTS(SELECT 1 FROM product_events e WHERE e.session_id=g.id AND x.subject='browser:'||e.visitor_id::text))`;
const excludedEvent = `EXISTS(SELECT 1 FROM admin_exclusions x WHERE x.subject='user:'||e.user_id::text OR x.subject='browser:'||e.visitor_id::text OR x.subject='session:'||e.session_id::text OR x.subject=(SELECT COALESCE('user:'||s.user_id::text,'guest:'||md5(s.guest_session_hash)) FROM game_sessions s WHERE s.id=e.session_id))`;
export async function adminAnalytics(days: number, includeTests = false) {
  if (![7, 30, 90].includes(days))
    throw new HttpError(400, "Choose 7, 30, or 90 days.");
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const run = (sql: string) =>
      client.query(sql, [days, includeTests]).then((r) => r.rows);
    const cte = `WITH runs AS (SELECT g.*,${owner} owner,
   (SELECT count(*)::int FROM game_answers a WHERE a.session_id=g.id) answered,
   (SELECT count(*)::int FROM game_questions q WHERE q.session_id=g.id) total,
   COALESCE((SELECT max(a.answered_at) FROM game_answers a WHERE a.session_id=g.id),g.created_at) last_answer
   FROM game_sessions g WHERE g.created_at>=now()-$1*interval '1 day' AND g.is_ranked AND ($2 OR NOT ${excludedRun})) `;
    const events = `WITH events AS (SELECT e.* FROM product_events e WHERE e.created_at>=now()-$1*interval '1 day' AND ($2 OR NOT ${excludedEvent})) `;
    const metrics = (
      await run(
        cte +
          `SELECT count(*)::int opened,count(DISTINCT owner)::int players,count(*) FILTER(WHERE answered>0)::int started,
   count(*) FILTER(WHERE completed_at IS NOT NULL)::int completed,
   count(*) FILTER(WHERE completed_at IS NULL AND last_answer<now()-interval '30 minutes')::int stalled,
   count(*) FILTER(WHERE kind='onboarding')::int legacy,
   (SELECT count(*)::int FROM (SELECT owner FROM runs WHERE completed_at IS NOT NULL AND kind='daily' GROUP BY owner HAVING count(DISTINCT edition)>1) p) AS "returning" FROM runs`,
      )
    )[0];
    const activity = await run(
      cte +
        `SELECT (created_at AT TIME ZONE 'America/Los_Angeles')::date::text AS day,count(*)::int opened,count(*) FILTER(WHERE completed_at IS NOT NULL)::int completed FROM runs GROUP BY 1 ORDER BY 1`,
    );
    const progress = await run(
      cte +
        `SELECT n AS position,count(*) FILTER(WHERE answered>=n)::int reached FROM runs CROSS JOIN generate_series(0,5) n WHERE kind='daily' AND total=5 GROUP BY n ORDER BY n`,
    );
    const screens = await run(
      events +
        `SELECT screen,count(DISTINCT visit_id) FILTER(WHERE name='screen_view')::int visits,
   round((sum((properties->>'activeMs')::numeric) FILTER(WHERE name='screen_exit'))/1000/NULLIF(count(DISTINCT visit_id) FILTER(WHERE name='screen_view'),0))::int seconds
   FROM events WHERE screen IS NOT NULL GROUP BY screen ORDER BY visits DESC`,
    );
    const lastScreens = await run(
      events +
        ` ,last_seen AS (SELECT DISTINCT ON(visit_id) visit_id,screen,created_at FROM events WHERE name='screen_view' ORDER BY visit_id,created_at DESC)
   SELECT screen,count(*)::int visits FROM last_seen WHERE created_at<now()-interval '30 minutes' AND screen<>'complete' GROUP BY screen ORDER BY visits DESC`,
    );
    const visitMetrics = (
      await run(
        events +
          `SELECT count(DISTINCT visit_id)::int visits,count(DISTINCT visitor_id)::int browsers,
   count(DISTINCT visit_id) FILTER(WHERE name='claim_result' AND properties->>'outcome'='success')::int claims,
   count(DISTINCT visit_id) FILTER(WHERE name='share_result' AND properties->>'outcome' IN ('copied','copied-gif','copied-text'))::int copies FROM events`,
      )
    )[0];
    const funnel = await run(
      events +
        ` ,firsts AS (SELECT visit_id,min(created_at) FILTER(WHERE name='screen_view' AND screen='welcome') welcome FROM events GROUP BY visit_id),
   steps AS (SELECT f.visit_id,f.welcome,
    min(e.created_at) FILTER(WHERE e.name='screen_view' AND e.screen='worldview') topics,
    min(e.created_at) FILTER(WHERE e.name='claim_result' AND e.properties->>'outcome'='success') claimed,
    min(e.created_at) FILTER(WHERE e.name='screen_view' AND e.screen='revealed') answered,
    min(e.created_at) FILTER(WHERE e.name='screen_view' AND e.screen='complete') complete,
    min(e.created_at) FILTER(WHERE e.name='share_result' AND e.properties->>'outcome' IN ('copied','copied-gif','copied-text')) copied
    FROM firsts f JOIN events e ON e.visit_id=f.visit_id AND e.created_at>=f.welcome WHERE f.welcome IS NOT NULL GROUP BY f.visit_id,f.welcome)
   SELECT count(*)::int welcome,count(*) FILTER(WHERE topics IS NOT NULL)::int topics,count(*) FILTER(WHERE claimed>=topics)::int claimed,
    count(*) FILTER(WHERE claimed>=topics AND answered>=claimed)::int answered,count(*) FILTER(WHERE claimed>=topics AND answered>=claimed AND complete>=answered)::int complete,
    count(*) FILTER(WHERE claimed>=topics AND answered>=claimed AND complete>=answered AND copied>=complete)::int copied FROM steps`,
    );
    const problems = await run(
      events +
        `SELECT name,properties->>'action' action,properties->>'outcome' outcome,properties->>'status' status,count(*)::int count
   FROM events WHERE name IN ('flow_error','claim_result','share_result') GROUP BY 1,2,3,4 ORDER BY count DESC`,
    );
    const devices = await run(
      events +
        `SELECT device,browser,count(DISTINCT visit_id)::int visits,count(DISTINCT visit_id) FILTER(WHERE screen='complete' AND name='screen_view')::int completed FROM events GROUP BY 1,2 ORDER BY visits DESC`,
    );
    const questions = await run(
      cte +
        `SELECT q.question_id id,min(q.snapshot->>'prompt') prompt,count(*)::int offered,count(a.*)::int answered,
   round(avg(a.score))::float score,round(100.0*count(*) FILTER(WHERE a.captured)/NULLIF(count(a.*),0),1)::float hit,
   count(*) FILTER(WHERE a.session_id IS NULL AND r.completed_at IS NULL AND r.last_answer<now()-interval '30 minutes')::int stalled
   FROM runs r JOIN game_questions q ON q.session_id=r.id LEFT JOIN game_answers a ON (a.session_id,a.question_id)=(q.session_id,q.question_id)
   WHERE q.position<=r.answered GROUP BY q.question_id ORDER BY offered DESC LIMIT 100`,
    );
    const people = await run(
      cte +
        `SELECT r.owner subject,max(u.username) username,count(*)::int runs,sum(r.answered)::int answers,
   count(*) FILTER(WHERE r.completed_at IS NOT NULL)::int completed,max(r.last_answer) last_seen,
   EXISTS(SELECT 1 FROM admin_exclusions x WHERE x.subject=r.owner) excluded FROM runs r LEFT JOIN users u ON u.id=r.user_id GROUP BY r.owner ORDER BY last_seen DESC LIMIT 200`,
    );
    const recentVisits = await run(
      events +
        `SELECT visit_id id,visitor_id browser_id,max(u.username) username,min(e.created_at) started,max(e.created_at) last_seen,
   (array_agg(e.screen ORDER BY e.created_at DESC) FILTER(WHERE e.name='screen_view'))[1] screen,max(e.device) device,max(e.browser) browser,
   EXISTS(SELECT 1 FROM admin_exclusions x WHERE x.subject='browser:'||e.visitor_id::text) excluded
   FROM events e LEFT JOIN users u ON u.id=e.user_id GROUP BY visit_id,visitor_id ORDER BY last_seen DESC LIMIT 100`,
    );
    const tracking =
      (
        await client.query(
          "SELECT value FROM admin_settings WHERE key='tracking_started'",
        )
      ).rows[0]?.value ?? null;
    return {
      days,
      includeTests,
      tracking,
      metrics,
      activity,
      progress,
      screens,
      lastScreens,
      visitMetrics,
      funnel: funnel[0],
      problems,
      devices,
      questions,
      people,
      recentVisits,
    };
  });
}
export async function adminPerson(subject: string) {
  if (
    !/^(user:[0-9a-f-]{36}|guest:[0-9a-f]{32}|browser:[0-9a-f-]{36})$/.test(
      subject,
    )
  )
    throw new HttpError(400, "Choose a player or browser.");
  const isBrowser = subject.startsWith("browser:");
  if (isBrowser && !uuid(subject.slice(8)))
    throw new HttpError(400, "Invalid browser.");
  const games = (
    await query(
      `SELECT g.id,g.edition::text,g.kind,g.created_at,g.completed_at,g.is_ranked,u.username,
  (SELECT jsonb_agg(jsonb_build_object('position',q.position+1,'prompt',q.snapshot->>'prompt','truth',q.snapshot->'trueValue','unit',q.snapshot->>'unit',
    'estimate',a.initial_estimate,'lower',a.lower_bound,'upper',a.upper_bound,'score',a.score,'hit',a.captured,'answeredAt',a.answered_at) ORDER BY q.position)
   FROM game_questions q LEFT JOIN game_answers a ON (a.session_id,a.question_id)=(q.session_id,q.question_id) WHERE q.session_id=g.id) answers
  FROM game_sessions g LEFT JOIN users u ON u.id=g.user_id
  WHERE ${isBrowser ? "EXISTS(SELECT 1 FROM product_events e WHERE e.session_id=g.id AND e.visitor_id=$1::uuid)" : owner + "=$1"} ORDER BY g.created_at DESC LIMIT 100`,
      [isBrowser ? subject.slice(8) : subject],
    )
  ).rows;
  const events = (
    await query(
      `SELECT e.id,e.name,e.screen,e.properties,e.created_at,e.device,e.browser,e.visit_id,e.visitor_id,e.session_id
  FROM product_events e WHERE ${isBrowser ? "e.visitor_id=$1::uuid" : "('user:'||e.user_id::text=$1 OR EXISTS(SELECT 1 FROM game_sessions g WHERE g.id=e.session_id AND " + owner + "=$1))"}
  ORDER BY e.created_at DESC LIMIT 300`,
      [isBrowser ? subject.slice(8) : subject],
    )
  ).rows;
  return { subject, games, events };
}
export async function setAdminExclusion(
  body: Record<string, unknown>,
  actor: string,
) {
  const subject = String(body.subject);
  if (
    !/^(user:[0-9a-f-]{36}|guest:[0-9a-f]{32}|browser:[0-9a-f-]{36})$/.test(
      subject,
    ) ||
    typeof body.excluded !== "boolean"
  )
    throw new HttpError(400, "Choose a player or browser.");
  const reason =
    typeof body.reason === "string"
      ? body.reason.trim().slice(0, 300)
      : "Internal testing";
  await transaction(async (client) => {
    if (body.excluded)
      await client.query(
        "INSERT INTO admin_exclusions(subject,reason) VALUES($1,$2) ON CONFLICT(subject) DO UPDATE SET reason=excluded.reason",
        [subject, reason],
      );
    else
      await client.query("DELETE FROM admin_exclusions WHERE subject=$1", [
        subject,
      ]);
    await client.query(
      "INSERT INTO admin_changes(subject,actor,before_value,after_value) VALUES($1,$2,$3,$4)",
      [
        "exclusion:" + subject,
        actor,
        JSON.stringify({}),
        JSON.stringify({ excluded: body.excluded, reason }),
      ],
    );
  });
  return { saved: true };
}
