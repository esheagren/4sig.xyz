import { query } from './db.js';
import { HttpError } from './http.js';
import type { Question } from './types.js';
import { ONBOARDING_VERSION } from './onboarding-data.js';

export async function onboardingForOwner(owner: string) {
  const guest = owner.startsWith('guest:');
  const { rows } = await query(
    `SELECT id,completed_at,(completed_at AT TIME ZONE 'America/Los_Angeles')::date::text completed_day
     FROM game_sessions WHERE ${guest ? 'guest_session_hash' : 'user_id'}=$1
     AND kind='onboarding' AND is_ranked LIMIT 1`,
    [guest ? owner.slice(6) : owner],
  );
  return rows[0] ?? null;
}
export async function hasDailyHistory(owner: string) {
  const guest = owner.startsWith('guest:');
  return !!(await query(
    `SELECT 1 FROM game_sessions WHERE ${guest ? 'guest_session_hash' : 'user_id'}=$1 AND kind='daily' LIMIT 1`,
    [guest ? owner.slice(6) : owner],
  )).rowCount;
}
export async function getOnboardingQuestions(): Promise<Question[]> {
  const { rows } = await query('SELECT questions FROM onboarding_editions WHERE version=$1', [ONBOARDING_VERSION]);
  if (!rows[0]) throw new HttpError(503, 'Your starting calibration is not ready yet. Please try again shortly.');
  return rows[0].questions;
}
