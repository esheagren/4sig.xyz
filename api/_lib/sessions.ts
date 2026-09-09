import { query } from "./db.js";
import { pacificDate } from "./questions.js";
import type { DailyStats, PerformanceHistoryEntry } from "./types.js";
export async function getDailyStats(
  userId: string,
  edition = pacificDate(),
): Promise<DailyStats> {
  const { rows } = await query(
    `SELECT g.user_id,u.username,u.avatar_icon,u.avatar_color,g.score,
    rank() OVER(ORDER BY g.score DESC)::int rank FROM completed_games g JOIN users u ON u.id=g.user_id
    WHERE g.is_ranked AND g.kind='daily' AND g.edition=$1 ORDER BY g.score DESC,u.username`,
    [edition],
  );
  const own = rows.find((r) => r.user_id === userId);
  const { rows: hit } = await query(
    "SELECT sum(questions_captured)::float8/nullif(sum(questions_answered),0)*100 rate FROM completed_games WHERE user_id=$1 AND is_ranked",
    [userId],
  );
  return {
    dailyRank: own?.rank ?? null,
    topScoreToday: rows[0]?.score ?? null,
    todaysAverage: rows.length
      ? rows.reduce((sum, r) => sum + r.score, 0) / rows.length
      : null,
    userScoreToday: own?.score ?? null,
    calibrationToday: hit[0]?.rate ?? null,
    totalParticipantsToday: rows.length,
    todayLeaderboard: rows.slice(0, 10).map((r) => ({
      rank: r.rank,
      username: r.username,
      avatarIcon: r.avatar_icon,
      avatarColor: r.avatar_color,
      score: r.score,
      isCurrentUser: r.user_id === userId,
    })),
  };
}
export async function getPerformanceHistory(
  userId: string,
  days = 7,
): Promise<PerformanceHistoryEntry[]> {
  const { rows } = await query(
    `WITH dates AS(SELECT generate_series(($2::date-$3::int+1)::timestamp,$2::date::timestamp,interval '1 day')::date date)
    SELECT d.date::text,COALESCE(max(g.score) FILTER(WHERE g.user_id=$1),0)::float8 user_score,
    COALESCE(avg(g.score),0)::float8 avg_score,
    COALESCE(sum(g.questions_captured) FILTER(WHERE g.user_id=$1)::float8/nullif(sum(g.questions_answered) FILTER(WHERE g.user_id=$1),0)*100,0)::float8 calibration
    FROM dates d LEFT JOIN completed_games g ON g.edition=d.date AND g.is_ranked AND g.kind='daily' GROUP BY d.date ORDER BY d.date`,
    [userId, pacificDate(), days],
  );
  return rows.map((r) => ({
    date: r.date,
    day: new Date(r.date + "T12:00:00Z").toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: "UTC",
    }),
    userScore: r.user_score,
    avgScore: r.avg_score,
    calibration: r.calibration,
  }));
}
export async function getOverallLeaderboard(userId = "", limit = 10) {
  const { rows } = await query(
    `SELECT u.id,u.username,u.avatar_icon,u.avatar_color,sum(g.score)::float8 score,count(*)::int games,
    rank() OVER(ORDER BY sum(g.score) DESC)::int rank FROM completed_games g JOIN users u ON u.id=g.user_id
    WHERE g.is_ranked AND g.kind='daily' GROUP BY u.id ORDER BY score DESC,u.username LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    rank: r.rank,
    displayName: r.username,
    avatarIcon: r.avatar_icon,
    avatarColor: r.avatar_color,
    totalScore: r.score,
    gamesPlayed: r.games,
    isCurrentUser: r.id === userId,
  }));
}
