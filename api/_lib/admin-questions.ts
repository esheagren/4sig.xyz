import type { QueryResultRow } from "pg";
import { chooseQuestions } from "./question-planner.js";
import { createHash } from "node:crypto";
import { query, transaction } from "./db.js";
import { HttpError } from "./http.js";
import { answerInsight } from "./answer-insights.js";
import { pacificDate } from "./questions.js";
import { questionPrompt } from "./question-copy.js";
import type { AnswerInsight } from "../../shared/answer-insight.js";

export const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const digest = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const date = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
export const addDays = (day: string, n: number) =>
  new Date(Date.parse(day + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
export type AdminQuestion = {
  id: string;
  prompt: string;
  answer: string;
  unit: string;
  topic: string;
  role: string;
  status: string;
  active: boolean;
  usage: string;
  period: string;
  geography: string;
  definition: string;
  notes: string;
  source: string;
  sourceUrl: string;
  verified: string;
  reviewDue: string;
  revision: number;
  insight: AnswerInsight;
  lastUsed: string | null;
};
export type CalendarDay = {
  date: string;
  ids: string[];
  state: "locked" | "planned" | "suggested";
  revision: string;
  prompts: Record<string, string>;
};
const select = `SELECT q.*,u.name unit,(SELECT max(d.date)::text FROM daily_questions d WHERE d.question_id=q.id AND d.is_published AND d.date<=(now() AT TIME ZONE 'America/Los_Angeles')::date) last_used FROM questions q LEFT JOIN units u ON u.id=q.unit_id`;
function editable(row: QueryResultRow): AdminQuestion {
  const context = row.answer_context ?? "";
  return {
    id: row.id,
    prompt: questionPrompt(row.question_text),
    answer: String(row.answer_value),
    unit: row.unit ?? "",
    topic: row.editorial_topic ?? "",
    role: row.editorial_role,
    status: row.editorial_status,
    active: row.is_active,
    usage: row.usage_type,
    period: row.observation_period ?? "",
    geography: row.geography ?? "",
    definition: row.measure_definition ?? "",
    notes: row.verification_notes ?? "",
    source: row.source_name ?? "",
    sourceUrl: row.source_url ?? "",
    verified: row.verified_at ? String(row.verified_at).slice(0, 10) : "",
    reviewDue: row.review_due ? String(row.review_due).slice(0, 10) : "",
    revision: row.admin_revision,
    insight: row.answer_insight ??
      answerInsight(row.id) ?? { short: context, more: "", sources: [] },
    lastUsed: row.last_used ?? null,
  };
}
const datedSelect = select.replace(
  "q.*,",
  "q.*,q.verified_at::text verified_at,q.review_due::text review_due,",
);
export async function adminWorkspace(today = pacificDate()) {
  // One consistent read; suggested days are forecasts, never silently published by a GET.
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const bank = (
      await client.query(datedSelect + " ORDER BY q.created_at,q.id")
    ).rows;
    const schedule = (
      await client.query(
        `SELECT date::text,date::text AS day,question_id,display_order,is_frozen,question_snapshot FROM daily_questions WHERE is_published AND date<=$1 ORDER BY date,display_order`,
        [addDays(today, 13)],
      )
    ).rows;
    const marker = (
      await client.query(
        "SELECT EXISTS(SELECT 1 FROM editorial_releases) enabled",
      )
    ).rows[0].enabled;
    const last = new Map<string, string>();
    for (const d of schedule) if (d.day < today) last.set(d.question_id, d.day);
    const days: CalendarDay[] = [];
    for (let n = 0; n < 14; n++) {
      const day = addDays(today, n),
        stored = schedule.filter((d) => d.day === day),
        locked = day <= today || stored.some((d) => d.is_frozen);
      const eligible = bank.filter(
        (q) =>
          q.is_active &&
          q.usage_type === "daily" &&
          (!marker ||
            (q.editorial_status === "ready" &&
              q.verified_at <= day &&
              q.review_due >= day)),
      );
      const chosen = stored
        .filter(
          (d) => d.is_frozen || eligible.some((q) => q.id === d.question_id),
        )
        .map((d) => bank.find((q) => q.id === d.question_id)!)
        .filter(Boolean);
      const candidates = eligible
        .filter((q) => !chosen.some((c) => c.id === q.id))
        .sort((a, b) => {
          const recent = (last.get(a.id) ?? "").localeCompare(
            last.get(b.id) ?? "",
          );
          return (
            recent ||
            createHash("md5")
              .update(a.id + day)
              .digest("hex")
              .localeCompare(
                createHash("md5")
                  .update(b.id + day)
                  .digest("hex"),
              )
          );
        });
      const ids = (
        stored.some((d) => d.is_frozen)
          ? chosen
          : chooseQuestions(chosen, candidates)
      ).map((q) => q.id);
      days.push({
        date: day,
        ids,
        state: locked
          ? "locked"
          : stored.length === 5
            ? "planned"
            : "suggested",
        revision: digest(
          stored.map((d) => [d.question_id, d.display_order, d.is_frozen]),
        ),
        prompts: Object.fromEntries(
          stored
            .filter((d) => d.is_frozen)
            .map((d) => [
              d.question_id,
              questionPrompt(d.question_snapshot?.prompt ?? ""),
            ]),
        ),
      });
      for (const id of ids) last.set(id, day);
    }
    return {
      today,
      timezone: "America/Los_Angeles",
      questions: bank.map(editable),
      days,
    };
  });
}
function text(v: unknown, name: string, max: number, required = false) {
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    throw new HttpError(400, `Check ${name}.`);
  return v.trim();
}
function sources(v: unknown): AnswerInsight["sources"] {
  if (!Array.isArray(v) || v.length > 12)
    throw new HttpError(400, "Use up to 12 context sources.");
  return v.map((s) => {
    const label = text(s?.label, "source label", 160, true),
      url = text(s?.url, "source URL", 2000, true);
    try {
      const u = new URL(url);
      if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
        throw Error();
    } catch {
      throw new HttpError(400, "Sources need a valid http or https URL.");
    }
    return { label, url: url.replaceAll(";", "%3B") };
  });
}
export async function saveAdminQuestion(
  input: Record<string, unknown>,
  actor: string,
) {
  if (!uuid(input.id) || !Number.isInteger(input.revision))
    throw new HttpError(400, "Choose a question and its current revision.");
  const value = {
    prompt: text(input.prompt, "question", 500, true),
    answer: text(input.answer, "answer", 120, true),
    unit: text(input.unit, "unit", 100),
    topic: text(input.topic, "topic", 100),
    role: input.role,
    status: input.status,
    period: text(input.period, "period", 160),
    geography: text(input.geography, "geography", 200),
    definition: text(input.definition, "definition", 2000),
    notes: text(input.notes, "editorial notes", 6000),
    source: text(input.source, "benchmark source", 1000),
    sourceUrl: text(input.sourceUrl, "benchmark links", 6000),
    verified: input.verified,
    reviewDue: input.reviewDue,
    insight: {
      short: text(
        (input.insight as AnswerInsight)?.short,
        "short context",
        500,
      ),
      more: text(
        (input.insight as AnswerInsight)?.more,
        "expanded context",
        2400,
      ),
      sources: sources((input.insight as AnswerInsight)?.sources),
    },
  };
  if (
    !["ready", "needs_review", "retired"].includes(String(value.status)) ||
    !["core", "reference"].includes(String(value.role))
  )
    throw new HttpError(400, "Choose a valid status and role.");
  if (
    !/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(value.answer) ||
    !Number.isFinite(Number(value.answer)) ||
    Math.abs(Number(value.answer)) > 1e100
  )
    throw new HttpError(400, "Enter a finite answer.");
  for (const field of ["verified", "reviewDue"] as const)
    if (value[field] !== "" && !date(value[field]))
      throw new HttpError(400, "Use valid review dates.");
  if (value.sourceUrl)
    sources(
      value.sourceUrl.split(";").map((url) => ({ url, label: "Benchmark" })),
    );
  if (
    value.status === "ready" &&
    (!(Number(value.answer) > 0) ||
      ![
        value.topic,
        value.period,
        value.geography,
        value.definition,
        value.notes,
        value.source,
        value.sourceUrl,
        value.verified,
        value.reviewDue,
        value.insight.short,
      ].every(Boolean) ||
      String(value.reviewDue) < String(value.verified))
  )
    throw new HttpError(
      400,
      "Ready questions need a positive answer, context, source, definition, topic, place, period, verification notes, and valid review dates.",
    );
  return transaction(async (client) => {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('editorial-bank'))",
    );
    const before = (
      await client.query("SELECT * FROM questions WHERE id=$1 FOR UPDATE", [
        input.id,
      ])
    ).rows[0];
    if (!before) throw new HttpError(404, "Question not found.");
    if (before.admin_revision !== input.revision)
      throw new HttpError(
        409,
        "This question changed in another tab. Reload it before saving.",
      );
    let unitId = null;
    if (value.unit) {
      unitId = (
        await client.query("SELECT id FROM units WHERE name=$1", [value.unit])
      ).rows[0]?.id;
      if (!unitId)
        unitId = (
          await client.query(
            "INSERT INTO units(id,name) VALUES(gen_random_uuid(),$1) RETURNING id",
            [value.unit],
          )
        ).rows[0].id;
    }
    const after = (
      await client.query(
        `UPDATE questions SET question_text=$2,answer_value=$3,unit_id=$4,editorial_topic=$5,editorial_role=$6,editorial_status=$7,is_active=($7='ready'),
   observation_period=$8,geography=$9,measure_definition=$10,verification_notes=$11,source_name=$12,source_url=$13,verified_at=$14,review_due=$15,
   answer_insight=$16,answer_context=$17,admin_revision=admin_revision+1,updated_at=now() WHERE id=$1 RETURNING *`,
        [
          input.id,
          value.prompt,
          value.answer,
          unitId,
          value.topic,
          value.role,
          value.status,
          value.period,
          value.geography,
          value.definition,
          value.notes,
          value.source,
          value.sourceUrl,
          value.verified || null,
          value.reviewDue || null,
          JSON.stringify(value.insight),
          `${value.insight.short} ${value.insight.more}`.trim(),
        ],
      )
    ).rows[0];
    await client.query(
      "INSERT INTO admin_changes(subject,actor,before_value,after_value) VALUES($1,$2,$3,$4)",
      [
        `question:${input.id}`,
        actor,
        JSON.stringify(before),
        JSON.stringify(after),
      ],
    );
    return { revision: after.admin_revision };
  });
}
export async function saveAdminLineup(
  input: Record<string, unknown>,
  actor: string,
  today = pacificDate(),
) {
  if (
    !date(input.date) ||
    input.date <= today ||
    input.date > addDays(today, 60)
  )
    throw new HttpError(
      400,
      "Only future editions within 60 days can be changed.",
    );
  const ids = input.ids;
  if (
    !Array.isArray(ids) ||
    ids.length !== 5 ||
    !ids.every(uuid) ||
    new Set(ids).size !== 5
  )
    throw new HttpError(400, "Choose five different questions.");
  return transaction(async (client) => {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('editorial-bank'))",
    );
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      "daily:" + input.date,
    ]);
    const before = (
      await client.query(
        "SELECT * FROM daily_questions WHERE date=$1 AND is_published ORDER BY display_order FOR UPDATE",
        [input.date],
      )
    ).rows;
    if (before.some((q) => q.is_frozen))
      throw new HttpError(409, "This edition is already locked.");
    if (
      digest(
        before.map((q) => [q.question_id, q.display_order, q.is_frozen]),
      ) !== input.revision
    )
      throw new HttpError(
        409,
        "The lineup changed. Reload the calendar before saving.",
      );
    const ready = (
      await client.query(
        `SELECT * FROM questions WHERE id=ANY($1::uuid[]) AND is_active AND usage_type='daily' AND editorial_status='ready' AND verified_at<=$2 AND review_due>=$2`,
        [ids, input.date],
      )
    ).rows;
    if (ready.length !== 5)
      throw new HttpError(
        400,
        "Every selected question must be ready and within its review dates on this day.",
      );
    if (ready.filter((q) => q.editorial_role === "reference").length > 1)
      throw new HttpError(400, "Use at most one reference question per day.");
    await client.query(
      "DELETE FROM daily_questions WHERE date=$1 AND NOT is_frozen",
      [input.date],
    );
    for (const [position, id] of ids.entries())
      await client.query(
        "INSERT INTO daily_questions(question_id,date,display_order,is_published) VALUES($1,$2,$3,true)",
        [id, input.date, position],
      );
    await client.query(
      "INSERT INTO admin_changes(subject,actor,before_value,after_value) VALUES($1,$2,$3,$4)",
      [
        `edition:${input.date}`,
        actor,
        JSON.stringify(before.map((q) => q.question_id)),
        JSON.stringify(ids),
      ],
    );
    return { saved: true };
  });
}
export async function adminQuestionHistory(id: string) {
  if (!uuid(id)) throw new HttpError(400, "Invalid question.");
  return (
    await query(
      "SELECT id,created_at,after_value->>'question_text' prompt,after_value->>'admin_revision' revision FROM admin_changes WHERE subject=$1 ORDER BY id DESC LIMIT 20",
      ["question:" + id],
    )
  ).rows;
}
