import assert from "node:assert/strict";
import test from "node:test";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { DESIGN_COOKIE, DESIGN_TTL, designToken, validDesignToken } from "../api/_lib/designspace-auth.js";
import handler from "../api/designspace.js";

test("design sessions reject tampering, expiry, malformed values, and other secrets", () => {
  const now = Date.UTC(2026, 8, 6);
  const token = designToken("test-session-secret", now);
  assert.equal(validDesignToken(token, "test-session-secret", now), true);
  assert.equal(validDesignToken(token, "different-secret", now), false);
  assert.equal(validDesignToken(token.slice(0, -1) + (token.endsWith("0") ? "1" : "0"), "test-session-secret", now), false);
  assert.equal(validDesignToken(token, "test-session-secret", now + DESIGN_TTL * 1000), false);
  assert.equal(validDesignToken(designToken("test-session-secret", now + 1000), "test-session-secret", now), false);
  for (const bad of [undefined, "", "invalid", "9999999999.a.b", token + ".extra"]) assert.equal(validDesignToken(bad, "test-session-secret", now), false);
});

test("preview HTML is only delivered with a valid server-signed cookie", async () => {
  const original = { hash: process.env.DESIGNSPACE_PASSWORD_HASH, secret: process.env.DESIGNSPACE_SESSION_SECRET };
  const secret = "a-test-signing-secret-at-least-thirty-two-characters";
  process.env.DESIGNSPACE_PASSWORD_HASH = "test-only-placeholder";
  process.env.DESIGNSPACE_SESSION_SECRET = secret;
  async function request(cookie?: string, method = "GET", origin?: string, bodyValue?: Record<string, string>) {
    let status = 200, body = "";
    const headers: Record<string, string> = {};
    const res = { setHeader(name: string, value: string) { headers[name.toLowerCase()] = value; return this; }, status(code: number) { status = code; return this; }, send(value: string) { body = value; return this; }, end() { return this; }, json(value: unknown) { body = JSON.stringify(value); return this; }, redirect(code: number, url: string) { status = code; headers.location = url; return this; } };
    await handler({ method, url: "/designspace", body: bodyValue, headers: { cookie, host: "4sig.xyz", origin } } as VercelRequest, res as unknown as VercelResponse);
    return { status, body, headers };
  }
  try {
    for (const cookie of [undefined, `${DESIGN_COOKIE}=forged`, `${DESIGN_COOKIE}=${designToken(secret, Date.now() - DESIGN_TTL * 1000)}`]) {
      const result = await request(cookie);
      assert.match(result.body, /type="password"/);
      assert.doesNotMatch(result.body, /id="studies"|Mona Lisa|const themes=/);
      assert.match(result.headers["cache-control"], /no-store/);
      // no-referrer turns a browser form's Origin into "null", blocking login.
      assert.equal(result.headers["referrer-policy"], "same-origin");
    }
    const allowed = await request(`${DESIGN_COOKIE}=${designToken(secret)}`);
    assert.match(allowed.body, /id="studies"/);
    assert.match(allowed.body, /Cultural/);
    assert.doesNotMatch(allowed.body, /__NONCE__|test-only-placeholder|a-test-signing-secret/);
    const nonce = /script nonce="([^"]+)"/.exec(allowed.body)?.[1];
    assert.ok(nonce);
    assert.ok(allowed.headers["content-security-policy"].includes(`'nonce-${nonce}'`));
    assert.match(allowed.headers["x-robots-tag"], /noindex/);
    assert.equal(allowed.headers["referrer-policy"], "same-origin");
    const logout = await request(undefined, "POST", "https://4sig.xyz", { action: "logout" });
    assert.equal(logout.status, 303);
    assert.equal(logout.headers.location, "/designspace");
    assert.equal((await request(undefined, "POST", "null")).status, 403);
    assert.equal((await request(undefined, "POST", "https://other.example")).status, 403);
    delete process.env.DESIGNSPACE_SESSION_SECRET;
    const unavailable = await request();
    assert.equal(unavailable.status, 503);
    assert.doesNotMatch(unavailable.body, /id="studies"/);
  } finally {
    for (const [key, value] of Object.entries({ DESIGNSPACE_PASSWORD_HASH: original.hash, DESIGNSPACE_SESSION_SECRET: original.secret })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
