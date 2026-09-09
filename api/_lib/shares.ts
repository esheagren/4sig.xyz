import { query } from "./db.js";
import { HttpError } from "./http.js";
import { normalizeColor, normalizeIcon } from "../../shared/player-profile.js";
import type { SharedScore } from "../../shared/player-profile.js";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function getSharedScore(id: unknown): Promise<SharedScore> {
  if (typeof id !== "string" || !uuid.test(id))
    throw new HttpError(404, "Score not found.");
  const { rows } = await query(
    `SELECT r.id,r.player,g.edition::text,g.score,g.is_ranked,g.kind,
    (SELECT json_agg(a.captured ORDER BY q.position) FROM game_answers a JOIN game_questions q
      ON (q.session_id,q.question_id)=(a.session_id,a.question_id) WHERE a.session_id=g.id) hits
    FROM result_shares r JOIN completed_games g ON g.id=r.session_id WHERE r.id=$1`,
    [id],
  );
  const r = rows[0];
  if (!r) throw new HttpError(404, "Score not found.");
  return {
    id: r.id,
    player: r.player,
    edition: r.edition,
    score: r.score,
    hits: r.hits,
    isRanked: r.is_ranked,
    kind: r.kind,
  };
}
export async function prepareShare(
  userId: string,
  sessionId: string,
): Promise<SharedScore> {
  const { rows } = await query(
    `SELECT u.username,u.avatar_icon,u.avatar_color FROM completed_games g JOIN users u ON u.id=g.user_id WHERE g.id=$1 AND g.user_id=$2`,
    [sessionId, userId],
  );
  if (!rows[0]) throw new HttpError(404, "Complete your game before sharing.");
  const u = rows[0];
  const player = {
    username: u.username,
    icon: normalizeIcon(u.avatar_icon),
    color: normalizeColor(u.avatar_color),
  };
  const inserted = await query(
    `INSERT INTO result_shares(session_id,player) VALUES($1,$2) ON CONFLICT(session_id) DO NOTHING RETURNING id`,
    [sessionId, JSON.stringify(player)],
  );
  const id =
    inserted.rows[0]?.id ??
    (
      await query("SELECT id FROM result_shares WHERE session_id=$1", [
        sessionId,
      ])
    ).rows[0].id;
  return getSharedScore(id);
}
