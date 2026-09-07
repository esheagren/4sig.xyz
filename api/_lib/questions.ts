import { query, transaction } from "./db.js";
import type { QueryResultRow } from "pg";
import { HttpError } from "./http.js";
import type { Question } from "./types.js";
export const pacificDate = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
export const DAILY_QUESTION_COUNT = 4;
const questionSelect = `SELECT q.*,u.name unit FROM questions q LEFT JOIN units u ON u.id=q.unit_id`;
function question(row: QueryResultRow): Question {
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
export async function getDailyQuestions(
  edition = pacificDate(),
): Promise<Question[]> {
  return transaction(async (client) => {
    // Stable schedule shared by every player, including after the imported calendar runs out.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      "daily:" + edition,
    ]);
    const { rows: existing } = await client.query(
      `SELECT d.question_id FROM daily_questions d JOIN questions q ON q.id=d.question_id
       WHERE d.date=$1 AND d.is_published AND q.is_active ORDER BY d.display_order LIMIT $2`,
      [edition, DAILY_QUESTION_COUNT],
    );
    const missing = DAILY_QUESTION_COUNT - existing.length;
    if (missing > 0) {
      await client.query(
        `INSERT INTO daily_questions(question_id,date,display_order)
         SELECT id,$1::date,(SELECT COALESCE(max(display_order),-1) FROM daily_questions WHERE date=$1)
           + row_number() OVER(ORDER BY recently_used,md5(id::text||$1))::int
         FROM (
           SELECT q.id,EXISTS(SELECT 1 FROM daily_questions d WHERE d.question_id=q.id
             AND d.date BETWEEN $1::date-7 AND $1::date-1) recently_used
           FROM questions q WHERE q.is_active AND q.usage_type='daily'
             AND NOT EXISTS(SELECT 1 FROM daily_questions d WHERE d.date=$1 AND d.question_id=q.id)
         ) candidates ORDER BY recently_used,md5(id::text||$1) LIMIT $2`,
        [edition, missing],
      );
    }
    const { rows } = await client.query(
      questionSelect +
        ` JOIN daily_questions d ON d.question_id=q.id WHERE d.date=$1 AND d.is_published AND q.is_active ORDER BY d.display_order LIMIT $2`,
      [edition, DAILY_QUESTION_COUNT],
    );
    if (rows.length !== DAILY_QUESTION_COUNT)
      throw new HttpError(503, "Today’s numbers are not ready yet.");
    return rows.map(question);
  });
}
