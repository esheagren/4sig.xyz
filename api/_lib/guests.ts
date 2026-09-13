import { randomBytes } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { hashToken, rateLimit } from "./auth.js";
import { query, transaction } from "./db.js";
const COOKIE = "four_sigma_guest";
export async function guestOwner(
  req: VercelRequest,
  res?: VercelResponse,
): Promise<string | null> {
  const token = req.headers.cookie
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const hash = hashToken(token);
    if (
      (
        await query(
          "SELECT 1 FROM guest_sessions WHERE token_hash=$1 AND expires_at>now()",
          [hash],
        )
      ).rowCount
    )
      return "guest:" + hash;
  }
  if (!res) return null;
  await rateLimit(req, "guest-start", 30);
  const next = randomBytes(32).toString("hex"),
    hash = hashToken(next);
  await query(
    "INSERT INTO guest_sessions(token_hash,expires_at) VALUES($1,now()+interval '30 days')",
    [hash],
  );
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${next}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return "guest:" + hash;
}
export async function guestGameForEdition(
  owner: string | null,
  edition: string,
  userId: string,
) {
  if (!owner) return null;
  const { rows } = await query(
    `SELECT g.id FROM game_sessions g JOIN guest_sessions v ON v.token_hash=$1
    WHERE g.kind='daily' AND g.edition=$2 AND ((g.guest_session_hash=v.token_hash AND g.is_ranked)
      OR (g.id=v.claimed_game_id AND g.user_id=$3 AND g.completed_at IS NULL))
    ORDER BY g.created_at DESC LIMIT 1`,
    [owner.slice(6), edition, userId],
  );
  return rows[0]?.id ?? null;
}
export async function attachGuestGame(
  userId: string,
  sessionId: unknown,
  owner: string | null,
) {
  if (
    !owner ||
    typeof sessionId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      sessionId,
    )
  )
    return;
  await transaction(async (client) => {
    // Same lock as startGame prevents a second ranked game during sign-in/claim.
    await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
    const { rows } = await client.query(
      "SELECT edition,is_ranked,kind FROM game_sessions WHERE id=$1 AND guest_session_hash=$2 FOR UPDATE",
      [sessionId, owner.slice(6)],
    );
    if (!rows[0]) return;
    const existing = await client.query(
      "SELECT id FROM game_sessions WHERE user_id=$1 AND (edition=$2 OR $3='onboarding') AND kind=$3 AND is_ranked",
      [userId, rows[0].edition, rows[0].kind],
    );
    await client.query(
      "UPDATE game_sessions SET user_id=$2,guest_session_hash=NULL,is_ranked=$3 WHERE id=$1",
      [sessionId, userId, rows[0].is_ranked && !existing.rowCount],
    );
    await client.query(
      "UPDATE guest_sessions SET claimed_game_id=$2 WHERE token_hash=$1",
      [owner.slice(6), sessionId],
    );
  });
}
