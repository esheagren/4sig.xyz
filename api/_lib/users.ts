import { validIcon } from "./player-profile.js";
import { validPlayerColor } from "../../shared/player-profile.js";
import { query } from "./db.js";
import { HttpError } from "./http.js";
import type { User } from "./types.js";

export const isValidUsername = (name: unknown): name is string =>
  typeof name === "string" && /^[a-zA-Z0-9_]{3,20}$/.test(name);
export async function isUsernameAvailable(name: string) {
  return !(
    await query("SELECT 1 FROM users WHERE lower(username)=lower($1)", [name])
  ).rowCount;
}
export async function getUserById(id: string): Promise<User | null> {
  const { rows } = await query(
    `SELECT u.*,
    COALESCE(sum(g.score),0)::float8 total_score, COALESCE(avg(g.score) FILTER(WHERE g.kind='daily'),0)::float8 average_score,
    COALESCE(sum(g.score) FILTER(WHERE g.kind='daily' AND g.edition >= date_trunc('week',now() AT TIME ZONE 'America/Los_Angeles')::date),0)::float8 weekly_score,
    count(g.id) FILTER(WHERE g.kind='daily')::int games_played, COALESCE(sum(g.questions_captured),0)::int questions_captured,
    COALESCE(sum(g.questions_answered),0)::int questions_answered,
    COALESCE(sum(g.questions_captured)::float8/nullif(sum(g.questions_answered),0),0)::float8 calibration_rate,
    COALESCE(max(g.score) FILTER(WHERE g.kind='daily'),0)::float8 best_single_score,max(g.completed_at) last_played_at,
    COALESCE(array_agg(DISTINCT g.edition::text ORDER BY g.edition::text) FILTER(WHERE g.edition IS NOT NULL AND g.kind='daily'),'{}') played_dates
    FROM users u LEFT JOIN completed_games g ON g.user_id=u.id AND g.is_ranked WHERE u.id=$1 GROUP BY u.id`,
    [id],
  );
  const { rows: baseline } = await query("SELECT id,score,questions_captured,questions_answered,onboarding_version FROM completed_games WHERE user_id=$1 AND kind='onboarding' AND is_ranked LIMIT 1", [id]);
  const row = rows[0];
  if (!row) return null;
  let streak = 0,
    best = 0,
    previous = "";
  for (const day of row.played_dates as string[]) {
    const gap = previous
      ? (Date.parse(day) - Date.parse(previous)) / 86400000
      : 0;
    streak = gap === 1 ? streak + 1 : 1;
    best = Math.max(best, streak);
    previous = day;
  }
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
  if (previous && (Date.parse(today) - Date.parse(previous)) / 86400000 > 1)
    streak = 0;
  return {
    id: row.id,
    avatarIcon: row.avatar_icon,
    avatarColor: row.avatar_color,
    hasPersonality: row.identity_chosen,
    deviceId: null,
    authId: null,
    email: row.email,
    username: row.username,
    isAnonymous: false,
    emailVerified: false,
    createdAt: row.created_at,
    lastPlayedAt: row.last_played_at,
    timezone: row.timezone,
    totalScore: row.total_score,
    averageScore: row.average_score,
    weeklyScore: row.weekly_score,
    gamesPlayed: row.games_played,
    sessionCount: row.games_played,
    questionsCaptured: row.questions_captured,
    questionsAnswered: row.questions_answered,
    onboarding: baseline[0] ? { sessionId: baseline[0].id, score: baseline[0].score, hits: baseline[0].questions_captured, count: baseline[0].questions_answered, version: baseline[0].onboarding_version } : null,
    calibrationRate: row.calibration_rate,
    currentStreak: streak,
    bestStreak: best,
    bestSingleScore: row.best_single_score,
    themePreference: row.theme_preference,
  };
}
export function publicUser(user: User) {
  return {
    ...user,
    displayName: user.username,
    deviceId: undefined,
    authId: undefined,
  };
}
export async function updateUserProfile(
  id: string,
  updates: {
    displayName?: unknown;
    avatarIcon?: unknown;
    avatarColor?: unknown;
    timezone?: unknown;
    themePreference?: unknown;
  },
) {
  if (
    updates.displayName !== undefined &&
    !isValidUsername(updates.displayName)
  )
    throw new HttpError(400, "Use 3–20 letters, numbers, or underscores.");
  if (updates.timezone !== undefined) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: String(updates.timezone) });
    } catch {
      throw new HttpError(400, "Invalid timezone.");
    }
  }
  if (
    updates.themePreference !== undefined &&
    (typeof updates.themePreference !== "string" ||
      updates.themePreference.length > 50)
  )
    throw new HttpError(400, "Invalid theme.");
  if (updates.avatarIcon !== undefined && !validIcon(updates.avatarIcon))
    throw new HttpError(400, "Choose an available pattern.");
  if (
    updates.avatarColor !== undefined &&
    !validPlayerColor(updates.avatarColor)
  )
    throw new HttpError(400, "Choose a valid color.");
  await query(
    `UPDATE users SET username=COALESCE($2,username), timezone=COALESCE($3,timezone),theme_preference=COALESCE($4,theme_preference),avatar_icon=COALESCE($5,avatar_icon),avatar_color=COALESCE($6,avatar_color),identity_chosen=identity_chosen OR $5 IS NOT NULL OR $6 IS NOT NULL WHERE id=$1`,
    [
      id,
      updates.displayName ?? null,
      updates.timezone ?? null,
      updates.themePreference ?? null,
      updates.avatarIcon ?? null,
      typeof updates.avatarColor === "string"
        ? updates.avatarColor.toLowerCase()
        : null,
    ],
  );
  return (await getUserById(id))!;
}
export async function getUserStats(id: string) {
  const user = await getUserById(id);
  if (!user) return null;
  const { rows } = await query(
    `SELECT a.question_id id,a.score::float8 score,a.captured,a.answered_at,
    json_build_object('question_text',q.snapshot->>'prompt') question
    FROM game_answers a JOIN game_sessions s ON s.id=a.session_id
    JOIN game_questions q ON (q.session_id,q.question_id)=(a.session_id,a.question_id)
    WHERE s.user_id=$1 AND s.completed_at IS NOT NULL AND s.is_ranked ORDER BY a.answered_at DESC LIMIT 10`,
    [id],
  );
  return { user, recentGames: rows, categoryStats: [] };
}
