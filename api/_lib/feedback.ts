import { query } from "./db.js";
export async function createFeedback(
  userId: string | null,
  feedbackText: string,
  userAgent?: string,
  pageUrl?: string,
) {
  const { rows } = await query(
    `INSERT INTO feedback(user_id,feedback_text,user_agent,page_url) VALUES($1,$2,$3,$4) RETURNING id,created_at`,
    [userId, feedbackText, userAgent ?? null, pageUrl ?? null],
  );
  return { id: rows[0].id, createdAt: rows[0].created_at };
}
