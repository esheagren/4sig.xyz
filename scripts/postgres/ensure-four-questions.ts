import dotenv from "dotenv";
const file = process.argv[2];
if (!file) throw new Error("Pass the target environment file explicitly.");
dotenv.config({ path: file, quiet: true, override: true });
if (
  !process.env.DATABASE_URL ||
  !new URL(process.env.DATABASE_URL).hostname.endsWith(".neon.tech")
)
  throw new Error("Expected a Neon database.");
const { pool, transaction } = await import("../../api/_lib/db.js");
const { getDailyQuestions, pacificDate, DAILY_QUESTION_COUNT } = await import(
  "../../api/_lib/questions.js"
);
try {
  const today = pacificDate();
  const { rows: dates } = await pool.query(
    "SELECT DISTINCT date::text edition FROM daily_questions WHERE date >= $1 ORDER BY edition",
    [today],
  );
  const editions = new Set([today, ...dates.map((r) => r.edition as string)]);
  let updatedSessions = 0;
  for (const edition of editions) {
    const questions = await getDailyQuestions(edition);
    updatedSessions += await transaction(async (client) => {
      const { rows: sessions } = await client.query(
        "SELECT id FROM game_sessions WHERE edition=$1 AND completed_at IS NULL ORDER BY id FOR UPDATE",
        [edition],
      );
      let changed = 0;
      for (const session of sessions) {
        const { rows: existing } = await client.query(
          "SELECT question_id,position FROM game_questions WHERE session_id=$1 ORDER BY position",
          [session.id],
        );
        if (existing.length >= DAILY_QUESTION_COUNT) continue;
        let position = Math.max(-1, ...existing.map((r) => Number(r.position)));
        const extra = questions
          .filter((q) => !existing.some((r) => r.question_id === q.id))
          .slice(0, DAILY_QUESTION_COUNT - existing.length);
        for (const q of extra)
          await client.query(
            "INSERT INTO game_questions(session_id,question_id,position,snapshot) VALUES($1,$2,$3,$4)",
            [session.id, q.id, ++position, JSON.stringify(q)],
          );
        if (existing.length + extra.length !== DAILY_QUESTION_COUNT)
          throw new Error("Could not complete an unfinished edition.");
        changed++;
      }
      return changed;
    });
  }
  console.log(
    JSON.stringify({
      editions: editions.size,
      questionsPerDay: DAILY_QUESTION_COUNT,
      unfinishedGamesUpdated: updatedSessions,
    }),
  );
} finally {
  await pool.end();
}
