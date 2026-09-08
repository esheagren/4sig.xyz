import type { PoolClient } from "pg";
import {
  question,
  scheduleEdition,
  pacificDate,
} from "../../api/_lib/questions.js";
export interface EditorialQuestion {
  id: string;
  audit_number: number;
  editorial_status: "ready" | "needs_review" | "retired";
  editorial_role: "core" | "reference";
  editorial_topic: string;
  verification_notes: string;
  expected: {
    question_text: string;
    answer_value: string | number;
    source_url: string | null;
    answer_context: string | null;
    unit_id: string | null;
  };
  question_text?: string;
  answer_value?: number;
  unit_name?: string;
  observation_period?: string;
  geography?: string;
  measure_definition?: string;
  source_name?: string;
  source_url?: string;
  answer_context?: string;
  verified_at?: string;
  review_due?: string;
}
export interface EditorialRelease {
  id: string;
  questions: EditorialQuestion[];
}
export function validateRelease(release: EditorialRelease) {
  if (
    !release.id ||
    !Array.isArray(release.questions) ||
    !release.questions.length
  )
    throw new Error("Empty editorial release");
  const ids = new Set<string>();
  for (const q of release.questions) {
    if (!q.id || ids.has(q.id))
      throw new Error("Missing or duplicate question ID");
    ids.add(q.id);
    if (
      !["ready", "needs_review", "retired"].includes(q.editorial_status) ||
      !["core", "reference"].includes(q.editorial_role)
    )
      throw new Error("Invalid editorial status or role");
    if (!q.expected || !q.editorial_topic || !q.verification_notes)
      throw new Error("Missing review record");
    if (
      q.unit_name !== undefined &&
      (typeof q.unit_name !== "string" ||
        !q.unit_name.trim() ||
        q.unit_name.length > 80)
    )
      throw new Error("Invalid unit name");
    if (q.editorial_status !== "ready") continue;
    for (const key of [
      "question_text",
      "observation_period",
      "geography",
      "measure_definition",
      "source_name",
      "source_url",
      "answer_context",
      "verified_at",
      "review_due",
    ] as const)
      if (!q[key]?.trim()) throw new Error(`Missing ${key} for ${q.id}`);
    if (!Number.isFinite(q.answer_value) || q.answer_value! <= 0)
      throw new Error("Invalid answer");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(q.verified_at!) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(q.review_due!) ||
      q.review_due! < q.verified_at!
    )
      throw new Error("Invalid review dates");
    for (const link of q.source_url!.split(";")) {
      const url = new URL(link);
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error("Invalid source URL");
    }
  }
}
const fingerprints = async (client: PoolClient) =>
  (
    await client.query(`SELECT
 (SELECT md5(COALESCE(jsonb_agg(to_jsonb(g) ORDER BY session_id,question_id)::text,'[]')) FROM game_questions g) questions,
 (SELECT md5(COALESCE(jsonb_agg(to_jsonb(a) ORDER BY session_id,question_id)::text,'[]')) FROM game_answers a) answers`)
  ).rows[0];
// Caller uses a repeatable-read transaction: concurrent play is allowed without mistaking new games for edits.
export async function applyEditorialRelease(
  client: PoolClient,
  release: EditorialRelease,
  sha256: string,
  today = pacificDate(),
) {
  validateRelease(release);
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('editorial-bank'))",
  );
  const prior = (
    await client.query("SELECT sha256 FROM editorial_releases WHERE id=$1", [
      release.id,
    ])
  ).rows[0];
  if (prior) {
    if (prior.sha256 !== sha256)
      throw new Error("Applied release has a different checksum");
    return { alreadyApplied: true };
  }
  const before = await fingerprints(client);
  for (const q of release.questions) {
    const current = (
      await client.query("SELECT * FROM questions WHERE id=$1 FOR UPDATE", [
        q.id,
      ])
    ).rows[0];
    if (!current) throw new Error(`Missing question ${q.id}`);
    for (const [key, value] of Object.entries(q.expected)) {
      if (
        key === "answer_value"
          ? Number(current[key]) !== Number(value)
          : current[key] !== value
      )
        throw new Error(
          `Question ${q.id} changed since audit (${key}); re-review before applying`,
        );
    }
  }
  // Freeze published past/today and any future edition someone has started, before touching source rows.
  const { rows: protectedRows } = await client.query(
    `SELECT q.*,u.name unit,d.id schedule_id,d.question_snapshot,
  (SELECT g.snapshot FROM game_questions g JOIN game_sessions s ON s.id=g.session_id WHERE s.edition=d.date AND g.question_id=q.id ORDER BY s.created_at LIMIT 1) played_snapshot
  FROM daily_questions d JOIN questions q ON q.id=d.question_id LEFT JOIN units u ON u.id=q.unit_id
  WHERE d.is_published AND (d.date <= $1::date OR EXISTS(SELECT 1 FROM game_sessions s WHERE s.edition=d.date))`,
    [today],
  );
  for (const row of protectedRows)
    await client.query(
      `UPDATE daily_questions SET question_snapshot=$2,is_frozen=true WHERE id=$1`,
      [
        row.schedule_id,
        JSON.stringify(
          row.question_snapshot ?? row.played_snapshot ?? question(row),
        ),
      ],
    );
  for (const q of release.questions) {
    let unitId: string | null = null;
    if (q.unit_name !== undefined) {
      const name = q.unit_name.trim();
      const existing = (
        await client.query(
          "SELECT id FROM units WHERE name=$1 ORDER BY id LIMIT 1",
          [name],
        )
      ).rows[0];
      unitId =
        existing?.id ??
        (
          await client.query(
            "INSERT INTO units(id,name) VALUES(gen_random_uuid(),$1) RETURNING id",
            [name],
          )
        ).rows[0].id;
    }
    await client.query(
      `UPDATE questions SET editorial_status=$2,is_active=($2='ready'),editorial_role=$3,editorial_topic=$4,verification_notes=$5,
   verified_at=$6,review_due=$7,observation_period=$8,geography=$9,measure_definition=$10,
   question_text=COALESCE($11,question_text),answer_value=COALESCE($12,answer_value),source_name=COALESCE($13,source_name),
   source_url=COALESCE($14,source_url),answer_context=COALESCE($15,answer_context),unit_id=COALESCE($16,unit_id),updated_at=now() WHERE id=$1`,
      [
        q.id,
        q.editorial_status,
        q.editorial_role,
        q.editorial_topic,
        q.verification_notes,
        q.verified_at ?? null,
        q.review_due ?? null,
        q.observation_period ?? null,
        q.geography ?? null,
        q.measure_definition ?? null,
        q.question_text ?? null,
        q.answer_value ?? null,
        q.source_name ?? null,
        q.source_url ?? null,
        q.answer_context ?? null,
        unitId,
      ],
    );
  }
  await client.query(
    "INSERT INTO editorial_releases(id,sha256) VALUES($1,$2)",
    [release.id, sha256],
  );
  const { rows: dates } = await client.query(
    `SELECT date::text FROM (SELECT date FROM daily_questions WHERE date>$1::date
   UNION SELECT generate_series($1::date+1,$1::date+30,'1 day')::date) editions ORDER BY date`,
    [today],
  );
  await client.query(
    `DELETE FROM daily_questions WHERE date>$1::date AND NOT is_frozen
  AND NOT EXISTS(SELECT 1 FROM game_sessions s WHERE s.edition=daily_questions.date)`,
    [today],
  );
  for (const { date } of dates) await scheduleEdition(client, date);
  const after = await fingerprints(client);
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error("Historical game data changed; rolling back");
  return {
    alreadyApplied: false,
    editionsChecked: dates.length,
    preservedGameHashes: after,
    counts: (
      await client.query(
        "SELECT editorial_status,count(*)::int count FROM questions GROUP BY editorial_status ORDER BY editorial_status",
      )
    ).rows,
  };
}
