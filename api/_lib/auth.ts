import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolClient } from "pg";
import { query } from "./db.js";
import { HttpError } from "./http.js";
export { getUserById } from "./users.js";
const COOKIE = "four_sigma_session";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function sessionToken(req: VercelRequest) {
  const value = req.headers.cookie
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export async function getAuthUser(req: VercelRequest) {
  const token = sessionToken(req);
  if (!token) return null;
  const { rows } = await query(
    "SELECT user_id FROM auth_sessions WHERE token_hash=$1 AND expires_at>now()",
    [hashToken(token)],
  );
  return rows[0]
    ? { userId: rows[0].user_id as string, authId: null, isAnonymous: false }
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
export function setSessionCookie(res: VercelResponse, token: string | null) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${token ?? ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? 15552000 : 0}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
}
export async function revokeSession(req: VercelRequest) {
  const token = sessionToken(req);
  if (token)
    await query("DELETE FROM auth_sessions WHERE token_hash=$1", [
      hashToken(token),
    ]);
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
