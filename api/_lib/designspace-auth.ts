import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const DESIGN_COOKIE = "four_sigma_designspace";
export const DESIGN_TTL = 86400;

export function designToken(secret: string, now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + DESIGN_TTL}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

export function validDesignToken(token: string | undefined, secret: string, now = Date.now()) {
  if (!token || !/^\d{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token)) return false;
  const [expires, nonce, signature] = token.split(".");
  const seconds = Math.floor(now / 1000);
  if (Number(expires) <= seconds || Number(expires) > seconds + DESIGN_TTL) return false;
  const expected = createHmac("sha256", secret).update(`${expires}.${nonce}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
