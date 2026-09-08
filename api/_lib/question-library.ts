import { query } from "./db.js";
import { HttpError } from "./http.js";

// Deliberately exclude answers, source titles and editorial notes: those can all spoil a question.
export async function questionLibrary() {
  const { rows } =
    await query(`SELECT q.id, q.question_text AS prompt, u.name AS unit,
 q.editorial_status AS status, q.editorial_role AS role, q.editorial_topic AS topic,
 q.observation_period AS period, q.geography, q.verified_at::text AS verified,
 q.review_due::text AS "reviewDue", q.is_active AS active
 FROM questions q LEFT JOIN units u ON u.id=q.unit_id ORDER BY q.created_at,q.id`);
  return rows.map((row, index) => ({ ...row, number: index + 1 }));
}
export async function questionAnswers(ids: string[]) {
  if (!ids.length || ids.length > 25 || new Set(ids).size !== ids.length)
    throw new HttpError(400, "Choose between 1 and 25 questions.");
  for (const id of ids)
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      throw new HttpError(400, "Invalid question ID.");
  const { rows } = await query(
    `SELECT q.id,q.answer_value::text AS answer,u.name AS unit,
 q.answer_context AS context,q.source_name AS source,q.source_url AS "sourceUrl",
 q.measure_definition AS definition,q.verification_notes AS notes,
 (q.editorial_status='retired' AND q.answer_value=0) AS placeholder
 FROM questions q LEFT JOIN units u ON u.id=q.unit_id WHERE q.id=ANY($1::uuid[])`,
    [ids],
  );
  if (rows.length !== ids.length)
    throw new HttpError(404, "Question not found.");
  return rows;
}
