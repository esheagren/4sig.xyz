import { query, transaction } from "./db.js";
import type { PoolClient, QueryResultRow } from "pg";
import { HttpError } from "./http.js";
import type { Question } from "./types.js";
export const pacificDate = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
export const DAILY_QUESTION_COUNT = 4;
const questionSelect = `SELECT q.*,u.name unit FROM questions q LEFT JOIN units u ON u.id=q.unit_id`;
export function question(row: QueryResultRow): Question {
  return {
    id: row.id,
    prompt: row.question_text,
    unit: row.unit ?? "",
    trueValue: Number(row.answer_value),
    scoringReference: Number(row.scoring_reference),
    source: row.source_name ?? "",
    sourceUrl: row.source_url ?? "",
    answerContext: row.answer_context ?? "",
  };
}
export async function getQuestionById(id: string) {
  const { rows } = await query(questionSelect + " WHERE q.id=$1", [id]);
  return rows[0] ? question(rows[0]) : undefined;
}
// The release marker enables staged rollout: additive schema, compatible code, then reviewed data.
const eligible = `(q.is_active AND q.usage_type='daily' AND
 (NOT EXISTS(SELECT 1 FROM editorial_releases) OR
 (q.editorial_status='ready' AND q.verified_at <= $1::date AND q.review_due >= $1::date)))`;
export async function scheduleEdition(
  client: PoolClient,
  edition: string,
): Promise<Question[]> {
  // Also serializes editorial releases with requests that are choosing an edition.
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('editorial-bank'))",
  );
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    "daily:" + edition,
  ]);
  // A started edition remains the same for everyone, even if its questions are later retired.
  const { rows: frozen } = await client.query(
    `SELECT question_snapshot FROM daily_questions
    WHERE date=$1 AND is_published AND is_frozen ORDER BY display_order`,
    [edition],
  );
  if (
    frozen.length === DAILY_QUESTION_COUNT &&
    frozen.every((r) => r.question_snapshot)
  )
    return frozen.map((r) => r.question_snapshot as Question);
  if (frozen.length)
    throw new HttpError(503, "This archived edition cannot be rescheduled.");
  await client.query(
    `DELETE FROM daily_questions d USING questions q WHERE d.question_id=q.id
    AND d.date=$1 AND NOT d.is_frozen AND (NOT d.is_published OR NOT ${eligible})`,
    [edition],
  );
  const { rows: selected } = await client.query(
    questionSelect +
      ` JOIN daily_questions d ON d.question_id=q.id
    WHERE d.date=$1 AND d.is_published AND ${eligible} ORDER BY d.display_order LIMIT $2`,
    [edition, DAILY_QUESTION_COUNT],
  );
  const { rows: candidates } = await client.query(
    questionSelect +
      ` WHERE ${eligible}
    AND NOT EXISTS(SELECT 1 FROM daily_questions d WHERE d.date=$1 AND d.question_id=q.id)
    ORDER BY (SELECT max(d.date) FROM daily_questions d WHERE d.question_id=q.id AND d.is_published AND d.date < $1::date) ASC NULLS FIRST,
    md5(q.id::text||$1)`,
    [edition],
  );
  while (selected.length < DAILY_QUESTION_COUNT && candidates.length) {
    const topics = new Set(selected.map((r) => r.editorial_topic));
    const hasReference = selected.some((r) => r.editorial_role === "reference");
    const permitted = candidates.filter(
      (r) => !hasReference || r.editorial_role !== "reference",
    );
    if (!permitted.length) break;
    const next =
      permitted.find((r) => !topics.has(r.editorial_topic)) ?? permitted[0];
    candidates.splice(candidates.indexOf(next), 1);
    await client.query(
      `INSERT INTO daily_questions(question_id,date,display_order) VALUES($1,$2,
      (SELECT COALESCE(max(display_order),-1)+1 FROM daily_questions WHERE date=$2))`,
      [next.id, edition],
    );
    selected.push(next);
  }
  if (selected.length !== DAILY_QUESTION_COUNT)
    throw new HttpError(503, "Today’s numbers are not ready yet.");
  for (const row of selected) {
    await client.query(
      `UPDATE daily_questions SET question_snapshot=$3, is_frozen=($2::date <= $4::date)
      WHERE question_id=$1 AND date=$2 AND NOT is_frozen`,
      [row.id, edition, JSON.stringify(question(row)), pacificDate()],
    );
  }
  return selected.map(question);
}
export async function getDailyQuestions(
  edition = pacificDate(),
): Promise<Question[]> {
  return transaction((client) => scheduleEdition(client, edition));
}
