import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pool, query, transaction } from "../api/_lib/db.ts";
import handler from "../api/admin.ts";
import { DESIGN_COOKIE, designToken } from "../api/_lib/designspace-auth.ts";
import {
  adminWorkspace,
  saveAdminQuestion,
  saveAdminLineup,
  addDays,
} from "../api/_lib/admin-questions.ts";
import {
  adminAnalytics,
  adminPerson,
  setAdminExclusion,
} from "../api/_lib/admin-analytics.ts";
import { recordEvents } from "../api/_lib/product-events.ts";
import { pacificDate, getDailyQuestions } from "../api/_lib/questions.ts";
import {
  startGame,
  saveAnswer,
  readGame,
  finishGame,
} from "../api/_lib/session-storage.ts";
import { createAuthSession } from "../api/_lib/auth.ts";
const secret = "admin-test-secret-with-at-least-thirty-two-characters";
async function request(
  url: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
  origin?: string,
) {
  let status = 200,
    result: unknown = "";
  const headers: Record<string, string> = {};
  const res = {
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
      return this;
    },
    status(n: number) {
      status = n;
      return this;
    },
    json(v: unknown) {
      result = v;
      return this;
    },
    send(v: unknown) {
      result = v;
      return this;
    },
    end() {
      return this;
    },
    redirect(n: number, u: string) {
      status = n;
      headers.location = u;
      return this;
    },
  };
  await handler(
    {
      url,
      method,
      body,
      headers: { host: "4sig.xyz", cookie, origin },
    } as VercelRequest,
    res as unknown as VercelResponse,
  );
  return { status, result, headers };
}
test("admin authentication, non-cacheable shell and same-origin edit boundary", async () => {
  process.env.DESIGNSPACE_PASSWORD_HASH = "unused-placeholder";
  process.env.DESIGNSPACE_SESSION_SECRET = secret;
  const cookie = `${DESIGN_COOKIE}=${designToken(secret)}`;
  const unauth = await request("/admin?data=workspace");
  assert.equal(unauth.status, 401);
  assert.match(unauth.headers["cache-control"], /no-store/);
  assert.equal(
    (
      await request(
        "/admin?data=save-question",
        "POST",
        {},
        undefined,
        "https://4sig.xyz",
      )
    ).status,
    401,
  );
  assert.equal(
    (await request("/admin?data=save-question", "POST", {}, cookie)).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/admin?data=save-question",
        "POST",
        {},
        cookie,
        "https://evil.example",
      )
    ).status,
    403,
  );
  const shell = await request("/admin", "GET", undefined, cookie);
  assert.equal(shell.status, 200);
  assert.match(String(shell.result), /admin-root/);
  assert.doesNotMatch(
    String(shell.result),
    /__ADMIN|trueValue|unused-placeholder/,
  );
  const data = await request("/admin?data=workspace", "GET", undefined, cookie);
  assert.equal(data.status, 200);
  assert.ok((data.result as { questions: unknown[] }).questions.length);
});
test("curation forecast, revisions, immutable scored snapshots, initial estimates, analytics and event attribution", async () => {
  // This suite runs after the existing integration suites, in a disposable database.
  await query(
    "TRUNCATE product_events,admin_exclusions,admin_changes,game_sessions,daily_questions CASCADE",
  );
  const today = pacificDate();
  await query(
    "UPDATE questions SET editorial_status='retired',is_active=false",
  );
  const ids: string[] = [];
  for (let n = 0; n < 12; n++)
    ids.push(
      (
        await query(
          `INSERT INTO questions(question_text,answer_value,is_active,editorial_status,editorial_topic,editorial_role,observation_period,geography,measure_definition,source_name,source_url,verification_notes,verified_at,review_due,answer_context)
  VALUES($1,100,true,'ready',$2,$3,'2025','World','Fixture definition','Fixture source','https://example.com','Test evidence',$4,$5,'A concrete comparison.') RETURNING id`,
          [
            "Fixture " + n,
            "Topic " + (n % 5),
            n === 11 ? "reference" : "core",
            addDays(today, -30),
            addDays(today, 90),
          ],
        )
      ).rows[0].id,
    );
  await query(
    "INSERT INTO editorial_releases(id,sha256) VALUES('admin-test','test') ON CONFLICT DO NOTHING",
  );
  const countBefore = (await query("SELECT count(*) FROM daily_questions"))
    .rows[0].count;
  const workspace = await adminWorkspace();
  assert.equal(workspace.days.length, 14);
  assert.equal(
    (await query("SELECT count(*) FROM daily_questions")).rows[0].count,
    countBefore,
    "GET cannot publish",
  );
  const selected = workspace.days[1],
    lineup = [...selected.ids].reverse();
  await saveAdminLineup(
    { date: selected.date, ids: lineup, revision: selected.revision },
    "test",
  );
  await assert.rejects(
    () =>
      saveAdminLineup(
        { date: selected.date, ids: lineup, revision: selected.revision },
        "test",
      ),
    /lineup changed/,
  );
  await assert.rejects(
    () => saveAdminLineup({ date: today, ids: lineup, revision: "" }, "test"),
    /future/,
  );
  assert.deepEqual((await adminWorkspace()).days[1].ids, lineup);
  const questions = await getDailyQuestions(today);
  assert.deepEqual(
    questions.map((q) => q.id),
    workspace.days[0].ids,
    "forecast uses real scheduler",
  );
  assert.equal(new Set(questions.map((q) => q.topic)).size, 5);
  const user = (
    await query(
      "INSERT INTO users(username) VALUES('AdminFixturePlayer') RETURNING id",
    )
  ).rows[0].id;
  const token = await transaction((c) => createAuthSession(c, user));
  const game = await startGame(user, today, questions);
  const q = questions[0];
  await assert.rejects(
    () => saveAnswer(user, game.sessionId, q.id, 90, 110, 111),
    /initial estimate/,
  );
  const original = await saveAnswer(user, game.sessionId, q.id, 90, 110, 103);
  assert.equal(original.initialEstimate, 103);
  await assert.rejects(
    () => saveAnswer(user, game.sessionId, q.id, 90, 110, 104),
    /already locked/,
  );
  const edit = (await adminWorkspace()).questions.find((v) => v.id === q.id)!;
  edit.prompt = "Updated future prompt";
  edit.answer = "200";
  edit.unit = "new fixture units";
  edit.insight = {
    short: "Updated concrete comparison.",
    more: "The number doubled in this example.",
    sources: [{ label: "Evidence", url: "https://example.com/source" }],
  };
  await saveAdminQuestion(edit, "test");
  await assert.rejects(() => saveAdminQuestion(edit, "test"), /another tab/);
  const current = (await adminWorkspace()).questions.find(
    (v) => v.id === q.id,
  )!;
  assert.equal(current.revision, 1);
  assert.equal(current.unit, "new fixture units");
  await assert.rejects(
    () =>
      saveAdminQuestion(
        { ...current, sourceUrl: "javascript:alert(1)" },
        "test",
      ),
    /http/,
  );
  const recovered = await readGame(game.sessionId, user);
  assert.equal(recovered.judgements[0].trueValue, 100);
  assert.equal(recovered.judgements[0].prompt, q.prompt);
  assert.equal(recovered.judgements[0].score, original.score);
  assert.equal(recovered.judgements[0].initialEstimate, 103);
  assert.equal(
    recovered.judgements[0].answerInsight?.short,
    edit.insight.short,
  );
  assert.equal(
    (await getDailyQuestions(today))[0].prompt,
    q.prompt,
    "today stays frozen",
  );
  for (const next of questions.slice(1))
    await saveAnswer(user, game.sessionId, next.id, 90, 110);
  await finishGame(user, game.sessionId);
  const before = await adminAnalytics(30);
  assert.equal(before.metrics.completed, 1);
  assert.equal(before.progress.find((p) => p.position === 5)?.reached, 1);
  const visitor = randomUUID(),
    visit = randomUUID(),
    eventId = randomUUID();
  const event = (
    name: string,
    screen?: string,
    properties: Record<string, unknown> = {},
  ) => ({ id: randomUUID(), name, screen, properties });
  const body = {
    visitorId: visitor,
    visitId: visit,
    referrer: "https://example.org/private?secret=1",
    events: [
      {
        id: eventId,
        name: "screen_view",
        screen: "welcome",
        properties: {
          sessionId: game.sessionId,
          questionId: q.id,
          password: "never stored",
          userId: "spoofed",
        },
      },
    ],
  };
  const req = {
    body,
    headers: {
      cookie: `four_sigma_session_v2=${token}`,
      "user-agent": "Mozilla iPhone Safari",
    },
  } as unknown as VercelRequest;
  await recordEvents(req);
  await recordEvents(req);
  assert.equal(
    (await query("SELECT count(*) FROM product_events")).rows[0].count,
    "1",
  );
  const recorded = (await query("SELECT * FROM product_events")).rows[0];
  assert.equal(recorded.user_id, user);
  assert.equal(recorded.session_id, game.sessionId);
  assert.equal(recorded.referrer_host, "example.org");
  assert.deepEqual(recorded.properties, {});
  for (const e of [
    event("screen_view", "worldview"),
    event("claim_result", undefined, { outcome: "success" }),
    event("screen_view", "revealed", { sessionId: game.sessionId }),
    event("screen_view", "complete", { sessionId: game.sessionId }),
    event("share_result", undefined, { outcome: "copied-gif" }),
  ])
    await recordEvents({
      ...req,
      body: { ...body, events: [e] },
    } as VercelRequest);
  const report = await adminAnalytics(30);
  assert.equal(report.visitMetrics.visits, 1);
  assert.equal(report.funnel.copied, 1);
  assert.equal(
    report.people.find((p) => p.subject === "user:" + user)?.completed,
    1,
  );
  const detail = await adminPerson("user:" + user);
  assert.equal(detail.games[0].answers[0].estimate, 103);
  assert.equal(detail.games[0].answers[1].estimate, null);
  assert.doesNotMatch(
    JSON.stringify(detail),
    /password|session_hash|token_hash|email/,
  );
  const orderedVisit = randomUUID();
  await recordEvents({
    ...req,
    body: {
      ...body,
      visitId: orderedVisit,
      events: [
        event("screen_view", "welcome"),
        event("screen_view", "scoring"),
        event("screen_view", "worldview"),
      ],
    },
  } as VercelRequest);
  assert.deepEqual(
    (
      await query(
        "SELECT screen FROM product_events WHERE visit_id=$1 ORDER BY created_at",
        [orderedVisit],
      )
    ).rows.map((e) => e.screen),
    ["welcome", "scoring", "worldview"],
    "batched events retain screen order",
  );
  await assert.rejects(
    () => recordEvents({ ...req, body: "{bad json" } as VercelRequest),
    /Invalid event batch/,
  );
  await assert.rejects(
    () => saveAdminQuestion({ ...current, answer: "0xFF" }, "test"),
    /finite answer/,
  );
  const spoofedSession = randomUUID();
  await recordEvents({
    ...req,
    headers: {},
    body: {
      ...body,
      visitId: randomUUID(),
      events: [
        event("screen_view", "range", {
          sessionId: game.sessionId,
          questionId: q.id,
          userId: user,
        }),
        event("screen_view", "estimate", { sessionId: spoofedSession }),
      ],
    },
  } as VercelRequest);
  const guestEvents = (
    await query("SELECT * FROM product_events WHERE user_id IS NULL")
  ).rows;
  assert.ok(
    guestEvents.every((e) => e.session_id === null && e.question_id === null),
  );
  await setAdminExclusion(
    { subject: "browser:" + visitor, excluded: true },
    "test",
  );
  assert.equal((await adminAnalytics(30)).metrics.opened, 0);
  assert.equal((await adminAnalytics(30)).visitMetrics.visits, 0);
  assert.equal((await adminAnalytics(30, true)).metrics.opened, 1);
  await setAdminExclusion(
    { subject: "browser:" + visitor, excluded: false },
    "test",
  );
  assert.equal((await adminAnalytics(30)).metrics.opened, 1);
  await setAdminExclusion({ subject: "user:" + user, excluded: true }, "test");
  assert.equal((await adminAnalytics(30)).metrics.completed, 0);
  assert.equal((await adminPerson("user:" + user)).games.length, 1);
  const editedDay = (await adminWorkspace()).days[1];
  await query("UPDATE daily_questions SET is_frozen=true WHERE date=$1", [
    editedDay.date,
  ]);
  await assert.rejects(
    () =>
      saveAdminLineup(
        {
          date: editedDay.date,
          ids: editedDay.ids,
          revision: editedDay.revision,
        },
        "test",
      ),
    /locked/,
  );
  await pool.end();
});
