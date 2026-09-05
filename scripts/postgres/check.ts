import "dotenv/config";
import { pool } from "../../api/_lib/db.js";
try {
  const { rows } =
    await pool.query(`SELECT (SELECT count(*) FROM questions)::int questions,(SELECT count(*) FROM questions WHERE is_active)::int playable_questions,
 (SELECT count(*) FROM daily_questions)::int scheduled_questions,(SELECT count(*) FROM users)::int profiles,(SELECT count(*) FROM completed_games WHERE is_ranked)::int ranked_games,
 (SELECT sum(row_count) FROM legacy.supabase_exports)::int archived_rows`);
  console.log(rows[0]);
} finally {
  await pool.end();
}
