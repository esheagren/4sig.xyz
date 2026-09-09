import assert from "node:assert/strict";
import test from "node:test";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  DESIGN_COOKIE,
  DESIGN_TTL,
  designToken,
  validDesignToken,
} from "../api/_lib/designspace-auth.js";
import handler from "../api/designspace.js";

test("design sessions reject tampering, expiry, malformed values, and other secrets", () => {
  const now = Date.UTC(2026, 8, 6);
  const token = designToken("test-session-secret", now);
  assert.equal(validDesignToken(token, "test-session-secret", now), true);
  assert.equal(validDesignToken(token, "different-secret", now), false);
  assert.equal(
    validDesignToken(
      token.slice(0, -1) + (token.endsWith("0") ? "1" : "0"),
      "test-session-secret",
      now,
    ),
    false,
  );
  assert.equal(
    validDesignToken(token, "test-session-secret", now + DESIGN_TTL * 1000),
    false,
  );
  assert.equal(
    validDesignToken(
      designToken("test-session-secret", now + 1000),
      "test-session-secret",
      now,
    ),
    false,
  );
  for (const bad of [
    undefined,
    "",
    "invalid",
    "9999999999.a.b",
    token + ".extra",
  ])
    assert.equal(validDesignToken(bad, "test-session-secret", now), false);
});

test("preview HTML is only delivered with a valid server-signed cookie", async () => {
  const original = {
    hash: process.env.DESIGNSPACE_PASSWORD_HASH,
    secret: process.env.DESIGNSPACE_SESSION_SECRET,
  };
  const secret = "a-test-signing-secret-at-least-thirty-two-characters";
  process.env.DESIGNSPACE_PASSWORD_HASH = "test-only-placeholder";
  process.env.DESIGNSPACE_SESSION_SECRET = secret;
  async function request(
    cookie?: string,
    method = "GET",
    origin?: string,
    bodyValue?: Record<string, string>,
    url = "/designspace",
  ) {
    let status = 200,
      body = "";
    const headers: Record<string, string> = {};
    const res = {
      setHeader(name: string, value: string) {
        headers[name.toLowerCase()] = value;
        return this;
      },
      status(code: number) {
        status = code;
        return this;
      },
      send(value: string) {
        body = value;
        return this;
      },
      end() {
        return this;
      },
      json(value: unknown) {
        body = JSON.stringify(value);
        return this;
      },
      redirect(code: number, url: string) {
        status = code;
        headers.location = url;
        return this;
      },
    };
    await handler(
      {
        method,
        url,
        body: bodyValue,
        headers: { cookie, host: "4sig.xyz", origin },
      } as VercelRequest,
      res as unknown as VercelResponse,
    );
    return { status, body, headers };
  }
  try {
    for (const cookie of [
      undefined,
      `${DESIGN_COOKIE}=forged`,
      `${DESIGN_COOKIE}=${designToken(secret, Date.now() - DESIGN_TTL * 1000)}`,
    ]) {
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
    assert.doesNotMatch(
      allowed.body,
      /__NONCE__|test-only-placeholder|a-test-signing-secret/,
    );
    const nonce = /script nonce="([^"]+)"/.exec(allowed.body)?.[1];
    assert.ok(nonce);
    assert.ok(
      allowed.headers["content-security-policy"].includes(`'nonce-${nonce}'`),
    );
    assert.match(allowed.headers["x-robots-tag"], /noindex/);
    assert.equal(allowed.headers["referrer-policy"], "same-origin");
    const scorecards = await request(`${DESIGN_COOKIE}=${designToken(secret)}`, "GET", undefined, undefined, "/designspace?view=scorecards");
    assert.equal((scorecards.body.match(/<svg xmlns=/g) ?? []).length, 6);
    assert.match(scorecards.body, /1,286.4/);
    assert.match(scorecards.body, /87.5%/);
    assert.doesNotMatch(scorecards.body, /__INK_EXPLORATIONS__|__NONCE__|__SCORECARD_BOOTSTRAP__/);
    assert.match(scorecards.body, /id="scorecard-studies"/);
    assert.match(scorecards.headers["content-security-policy"], /worker-src 'self'/);
    assert.match(scorecards.headers["content-security-policy"], /img-src data: blob:/);
    for (const pattern of ['Orbit', 'Wave', 'Spiral', 'Pendulum', 'Bloom', 'Braid']) assert.ok(scorecards.body.includes(pattern));
    assert.match(scorecards.body, /designspace-scorecards/);
    const scorecardNonce = /script nonce="([^"]+)"/.exec(scorecards.body)?.[1];
    assert.ok(scorecards.headers["content-security-policy"].includes(`'nonce-${scorecardNonce}'`));
    const lockedCards = await request(undefined, "GET", undefined, undefined, "/designspace?view=scorecards");
    assert.match(lockedCards.body, /action="\/designspace\?view=scorecards"/);
    assert.doesNotMatch(lockedCards.body, /<svg/);
    const seededLogin = await request(undefined, "GET", undefined, undefined, "/designspace?view=scorecards&seed=AB12CD34EF56&name=custom&color=%23795078");
    assert.match(seededLogin.body, /view=scorecards&amp;seed=AB12CD34EF56&amp;name=custom&amp;color=%23795078/);
    const manager = await request(
      `${DESIGN_COOKIE}=${designToken(secret)}`,
      "GET",
      undefined,
      undefined,
      "/designspace?view=questions",
    );
    assert.match(manager.body, /Question library/);
    assert.match(
      manager.headers["content-security-policy"],
      /connect-src 'self'/,
    );
    for (const route of [
      "questions",
      "answers&ids=00000000-0000-0000-0000-000000000000",
    ]) {
      const denied = await request(
        undefined,
        "GET",
        undefined,
        undefined,
        "/api/designspace?data=" + route,
      );
      assert.equal(denied.status, 401);
      assert.doesNotMatch(
        denied.body,
        /trueValue|answer_value|source_url|Test one/,
      );
    }
    const library = await request(
      `${DESIGN_COOKIE}=${designToken(secret)}`,
      "GET",
      undefined,
      undefined,
      "/api/designspace?data=questions",
    );
    assert.equal(library.status, 200);
    assert.match(library.headers["content-type"], /application\/json/);
    const questions = JSON.parse(library.body).questions;
    assert.ok(questions.length >= 4);
    for (const q of questions)
      assert.deepEqual(
        Object.keys(q).sort(),
        [
          "id",
          "prompt",
          "unit",
          "status",
          "role",
          "topic",
          "period",
          "geography",
          "verified",
          "reviewDue",
          "active",
          "number",
          "glossary",
        ].sort(),
      );
    const revealed = await request(
      `${DESIGN_COOKIE}=${designToken(secret)}`,
      "GET",
      undefined,
      undefined,
      "/api/designspace?data=answers&ids=" + questions[0].id,
    );
    assert.equal(revealed.status, 200);
    assert.equal(JSON.parse(revealed.body).answers.length, 1);
    assert.ok("answer" in JSON.parse(revealed.body).answers[0]);
    const invalid = await request(
      `${DESIGN_COOKIE}=${designToken(secret)}`,
      "GET",
      undefined,
      undefined,
      "/api/designspace?data=answers&ids=bad",
    );
    assert.equal(invalid.status, 400);
    const oversized = await request(
      `${DESIGN_COOKIE}=${designToken(secret)}`,
      "GET",
      undefined,
      undefined,
      "/api/designspace?data=answers&ids=" +
        Array(26).fill(questions[0].id).join(","),
    );
    assert.equal(oversized.status, 400);
    const logout = await request(undefined, "POST", "https://4sig.xyz", {
      action: "logout",
    });
    assert.equal(logout.status, 303);
    assert.equal(logout.headers.location, "/designspace");
    assert.equal((await request(undefined, "POST", "null")).status, 403);
    assert.equal(
      (await request(undefined, "POST", "https://other.example")).status,
      403,
    );
    delete process.env.DESIGNSPACE_SESSION_SECRET;
    const unavailable = await request();
    assert.equal(unavailable.status, 503);
    assert.doesNotMatch(unavailable.body, /id="studies"/);
  } finally {
    for (const [key, value] of Object.entries({
      DESIGNSPACE_PASSWORD_HASH: original.hash,
      DESIGNSPACE_SESSION_SECRET: original.secret,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
