import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolClient } from "pg";
import { query } from "./db.js";
import { HttpError } from "./http.js";
export { getUserById } from "./users.js";
const COOKIE = "four_sigma_session_v2";
const LEGACY_COOKIE = "four_sigma_session";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
function sessionTokens(req: VercelRequest, includeLegacy = false) {
  const parts = (req.headers.cookie?.split(';') ?? []).map(part => part.trim());
  // The shared cookie is authoritative, even after logout or expiry. An older
  // host-only cookie must not silently sign someone back into another account.
  const names = !includeLegacy && parts.some(part => part.startsWith(COOKIE + '='))
    ? [COOKIE] : [COOKIE, LEGACY_COOKIE];
  return [...new Set(parts.filter(part => names.includes(part.split('=')[0]))
    .map(part => part.slice(part.indexOf('=') + 1))
    .filter(value => /^[a-f0-9]{64}$/.test(value)))];
}
export async function getAuthUser(req: VercelRequest) {
  const tokens = sessionTokens(req);
  if (!tokens.length) return null;
  // Migrate a valid old cookie only when the browser has no shared-cookie state.
  const { rows } = await query(
    `SELECT user_id,token_hash FROM auth_sessions
     WHERE token_hash=ANY($1::text[]) AND expires_at>now() ORDER BY created_at DESC,token_hash LIMIT 1`,
    [tokens.map(hashToken)],
  );
  return rows[0]
    ? { userId: rows[0].user_id as string, sessionHash: rows[0].token_hash as string, authId: null, isAnonymous: false }
    : null;
}
export async function requireUser(req: VercelRequest) {
  const user = await getAuthUser(req);
  if (!user) throw new HttpError(401, "Choose a username to save your score.");
  return user;
}
export async function createAuthSession(client: PoolClient, userId: string) {
  const token = randomBytes(32).toString("hex");
  await client.query(
    `INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '180 days')`,
    [hashToken(token), userId],
  );
  return token;
}
export function setSessionCookie(res: VercelResponse, token: string | null, req: VercelRequest) {
  const host = req.headers.host?.toLowerCase().split(':')[0];
  const shared = host === '4sig.xyz' || host === 'www.4sig.xyz';
  const secure = shared || process.env.NODE_ENV === 'production' ? '; Secure' : '';
  // A non-credential logout marker blocks legacy host-only cookies on both hosts.
  // It lasts at least as long as those old cookies; a new sign-in replaces it.
  const cookie = `${COOKIE}=${token ?? 'signed-out'}; Path=/; HttpOnly; SameSite=Lax; Max-Age=15552000${secure}`;
  res.setHeader('Set-Cookie', cookie + (shared ? '; Domain=4sig.xyz' : ''));
}
export async function renewAuthSession(req: VercelRequest, res: VercelResponse, sessionHash: string) {
  const token = sessionTokens(req).find(value => hashToken(value) === sessionHash);
  if (!token) return;
  const result = await query(`UPDATE auth_sessions SET expires_at=now()+interval '180 days'
    WHERE token_hash=$1 AND expires_at>now()`, [sessionHash]);
  // Never recreate a revoked or expired session.
  if (result.rowCount) setSessionCookie(res, token, req);
}
export async function revokeSession(req: VercelRequest) {
  const tokens = sessionTokens(req, true);
  if (tokens.length) await query('DELETE FROM auth_sessions WHERE token_hash=ANY($1::text[])', [tokens.map(hashToken)]);
}
function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt-v1:${salt}:${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, encoded?: string) {
  const [version, salt, expected] = encoded?.split(":") ?? [];
  const valid =
    version === "scrypt-v1" &&
    /^[a-f0-9]{32}$/.test(salt) &&
    /^[a-f0-9]{128}$/.test(expected);
  // Do equivalent expensive work when the email does not exist.
  const actual = await derive(password, valid ? salt : "0".repeat(32));
  return !!valid && timingSafeEqual(actual, Buffer.from(expected, "hex"));
}
export async function rateLimit(
  req: VercelRequest,
  action: string,
  limit = 20,
) {
  const ip = process.env.VERCEL
    ? req.headers["x-vercel-forwarded-for"]
    : req.socket?.remoteAddress;
  const key = hashToken(`${action}:${ip ?? "unknown"}`);
  const { rows } = await query(
    `INSERT INTO auth_rate_limits(key,attempts,resets_at) VALUES($1,1,now()+interval '15 minutes')
    ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_rate_limits.resets_at<=now() THEN 1 ELSE auth_rate_limits.attempts+1 END,
    resets_at=CASE WHEN auth_rate_limits.resets_at<=now() THEN now()+interval '15 minutes' ELSE auth_rate_limits.resets_at END RETURNING attempts`,
    [key],
  );
  if (rows[0].attempts > limit)
    throw new HttpError(
      429,
      "Too many attempts. Please try again in 15 minutes.",
    );
}
