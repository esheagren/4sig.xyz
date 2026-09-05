import test from "node:test";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import assert from "node:assert/strict";
import auth from "../api/auth.ts";
import session from "../api/session.ts";
import userApi from "../api/user.ts";
import { pool, query } from "../api/_lib/db.ts";
import { Score } from "../api/_lib/scoring.ts";
import {
  quantity,
  makeShareText,
  parseAmount,
  initialBounds,
  fitDomain,
  validBounds,
} from "../src/components/interval/game.ts";

test("relative scoring and signed scientific notation", () => {
  assert.equal(quantity(400000, "people"), "400 thousand people");
  assert.equal(quantity(-196, "°C"), "-196 °C");
  const share = makeShareText(
    [],
    "https://4sig.xyz/",
    { username: "TestPlayer", icon: "diamond" },
    "2026-09-05",
  );
  assert.ok(share.includes("◇ TestPlayer"));
  assert.ok(share.includes("4σ · 2026-09-05"));
  assert.ok(share.endsWith("https://4sig.xyz/"));
  assert.equal(Score.calculateScore(1, 2, 3), 0);
  assert.equal(Score.calculateScore(10, 10, 10), 10000);
  assert.equal(Score.calculateScore(0, 1, 0), 50);
  assert.equal(
    Score.calculateScore(-2, -1, -1.5),
    Score.calculateScore(1, 2, 1.5),
  );
  assert.equal(
    Score.calculateScore(1, 2, 1.5),
    Score.calculateScore(0.01, 0.02, 0.015),
  );
  assert.ok(
    Score.calculateScore(140, 160, 150) > Score.calculateScore(100, 200, 150),
  );
  assert.equal(parseAmount("4E5"), 400000);
  assert.equal(parseAmount("-1.96E2"), -196);
  assert.equal(parseAmount("4E-5"), 0.00004);
  assert.ok(Number.isNaN(parseAmount("1e-400")));
  for (const n of [-196, -0.00001, 0, 0.001, 1e30]) {
    const b = initialBounds(n);
    assert.ok(validBounds(b));
    assert.ok(b.lower <= n && b.upper >= n);
    const d = fitDomain(b);
    assert.ok(d[0] <= b.lower && d[1] >= b.upper);
  }
});

type Client = { cookie?: string; ip: string };
async function call(
  handler: (req: VercelRequest, res: VercelResponse) => unknown,
  path: string,
  client: Client,
  body: unknown = {},
  method = "POST",
  extra: Record<string, string> = {},
) {
  let status = 200,
    data: ReturnType<typeof JSON.parse>;
  const headers: Record<string, string> = {};
  const req = {
    url: path,
    method,
    body,
    query: {},
    headers: { host: "localhost", cookie: client.cookie, ...extra },
    socket: { remoteAddress: client.ip },
  };
  const res = {
    setHeader(k: string, v: unknown) {
      headers[k.toLowerCase()] = String(v);
      return res;
    },
    status(n: number) {
      status = n;
      return res;
    },
    json(v: unknown) {
      data = v;
      return res;
    },
    end() {
      return res;
    },
  };
  await handler(
    req as unknown as VercelRequest,
    res as unknown as VercelResponse,
  );
  if (headers["set-cookie"])
    client.cookie = headers["set-cookie"].split(";")[0];
  return { status, data, headers };
}

test("Postgres API: profiles, ownership, resume, retries, ranking, credentials", async () => {
  const a: Client = { ip: "one" },
    b: Client = { ip: "two" },
    empty: Client = { ip: "guest" };
  assert.equal((await call(session, "/api/session/start", empty)).status, 401);
  const before = (await query("SELECT count(*)::int n FROM users")).rows[0].n;
  assert.equal(
    (await call(auth, "/api/auth/device", empty)).data.user.isAnonymous,
    true,
  );
  assert.equal(
    (await query("SELECT count(*)::int n FROM users")).rows[0].n,
    before,
    "visiting does not create an empty user",
  );
  assert.equal(
    (await call(auth, "/api/auth/claim-username", a, { username: "bad name" }))
      .status,
    400,
  );
  const claimed = await call(auth, "/api/auth/claim-username", a, {
    username: "MigrationTest",
  });
  assert.equal(claimed.status, 200);
  const id = claimed.data.user.id;
  assert.match(claimed.headers["set-cookie"], /HttpOnly; SameSite=Lax/);
  assert.equal(
    (
      await call(auth, "/api/auth/claim-username", b, {
        username: "migrationtest",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(auth, "/api/auth/claim-username", b, {
        username: "SecondPlayer",
      })
    ).status,
    200,
  );
  assert.equal(
    (await call(auth, "/api/auth/profile", a, { avatarIcon: "bogus" })).status,
    400,
  );
  assert.equal(
    (
      await call(auth, "/api/auth/profile", a, {
        avatarIcon: "spark",
        userId: "someone-else",
      })
    ).data.user.avatarIcon,
    "spark",
  );
  assert.equal(
    (await call(auth, "/api/auth/me", empty, {}, "GET", { "x-device-id": id }))
      .data.user.isAnonymous,
    true,
  );
  assert.equal(
    (
      await call(auth, "/api/auth/profile", a, { avatarIcon: "wave" }, "POST", {
        origin: "https://attacker.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        userApi,
        "/api/user/profile",
        a,
        { displayName: "RenamedPlayer" },
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal(
    (await call(userApi, "/api/user/profile", a, {}, "GET")).data.user
      .displayName,
    "RenamedPlayer",
  );
  const starts = await Promise.all([
    call(session, "/api/session/start", a),
    call(session, "/api/session/start", a),
  ]);
  assert.equal(starts[0].status, 200);
  assert.equal(starts[1].status, 200);
  assert.equal(
    starts[0].data.sessionId,
    starts[1].data.sessionId,
    "concurrent starts resume the same ranked attempt",
  );
  const game = starts[0].data;
  assert.ok(game.questions.length >= 3);
  assert.ok(
    !JSON.stringify(game).includes("trueValue"),
    "no answers exposed by start",
  );
  assert.equal(
    (
      await call(session, "/api/session/finalize", a, {
        sessionId: game.sessionId,
      })
    ).status,
    409,
  );
  const truths = (
    await query(
      "SELECT question_id,snapshot FROM game_questions WHERE session_id=$1 ORDER BY position",
      [game.sessionId],
    )
  ).rows;
  assert.equal(
    (
      await call(session, "/api/session/answer", b, {
        sessionId: game.sessionId,
        questionId: truths[0].question_id,
        lower: 0,
        upper: 1,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await call(session, "/api/session/answer", a, {
        sessionId: game.sessionId,
        questionId: truths[1].question_id,
        lower: 0,
        upper: 1,
      })
    ).status,
    409,
  );
  const original = truths[0].snapshot.trueValue;
  // Published games retain the answer they began with after editorial changes.
  await query(
    "UPDATE questions SET answer_value=answer_value+123 WHERE id=$1",
    [truths[0].question_id],
  );
  for (const [i, row] of truths.entries()) {
    const truth = row.snapshot.trueValue;
    const payload = {
      sessionId: game.sessionId,
      questionId: row.question_id,
      lower: truth,
      upper: truth,
    };
    const saved = await Promise.all([
      call(session, "/api/session/answer", a, payload),
      call(session, "/api/session/answer", a, payload),
    ]);
    for (const r of saved) {
      assert.equal(r.status, 200);
      assert.equal(r.data.judgement.score, 10000);
      assert.equal(r.data.judgement.trueValue, truth);
    }
    assert.equal(
      (
        await call(session, "/api/session/answer", a, {
          ...payload,
          upper: truth + 1,
        })
      ).status,
      409,
    );
    const resumed = await call(session, "/api/session/start", a);
    assert.equal(resumed.data.judgements.length, i + 1);
  }
  await query("UPDATE questions SET answer_value=$2 WHERE id=$1", [
    truths[0].question_id,
    original,
  ]);
  const finished = await Promise.all([
    call(session, "/api/session/finalize", a, { sessionId: game.sessionId }),
    call(session, "/api/session/finalize", a, { sessionId: game.sessionId }),
  ]);
  assert.equal(finished[0].status, 200);
  assert.equal(finished[1].data.score, 10000 * truths.length);
  assert.equal(
    (
      await query(
        "SELECT count(*)::int n FROM game_answers WHERE session_id=$1",
        [game.sessionId],
      )
    ).rows[0].n,
    truths.length,
  );
  assert.equal(
    (await call(auth, "/api/auth/me", a, {}, "GET")).data.user.gamesPlayed,
    1,
  );
  assert.equal(
    (await call(session, "/api/session/start", a)).data.completed,
    true,
  );
  const practice = (
    await call(session, "/api/session/start", a, { practice: true })
  ).data;
  assert.equal(practice.isRanked, false);
  assert.notEqual(practice.sessionId, game.sessionId);
  for (const q of practice.questions) {
    const truth = truths.find((r) => r.question_id === q.id)!.snapshot
      .trueValue;
    assert.equal(
      (
        await call(session, "/api/session/answer", a, {
          sessionId: practice.sessionId,
          questionId: q.id,
          lower: truth,
          upper: truth,
        })
      ).status,
      200,
    );
  }
  assert.equal(
    (
      await call(session, "/api/session/finalize", a, {
        sessionId: practice.sessionId,
      })
    ).status,
    200,
  );
  const stats = (await call(auth, "/api/auth/me", a, {}, "GET")).data.user;
  assert.equal(stats.gamesPlayed, 1);
  assert.equal(stats.totalScore, truths.length * 10000);
  assert.equal(stats.calibrationRate, 1);
  assert.equal(
    (await call(userApi, "/api/user/performance-history", a, {}, "GET")).data
      .history.length,
    7,
  );
  assert.equal(
    (
      await call(auth, "/api/auth/claim-account", a, {
        email: "migration@example.invalid",
        password: "short",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(auth, "/api/auth/claim-account", a, {
        email: "migration@example.invalid",
        password: "Testing-a-long-password",
      })
    ).status,
    200,
  );
  const oldCookie = a.cookie;
  assert.equal((await call(auth, "/api/auth/logout", a)).status, 200);
  assert.equal(
    (
      await call(
        auth,
        "/api/auth/me",
        { ip: "old", cookie: oldCookie },
        {},
        "GET",
      )
    ).data.user.isAnonymous,
    true,
  );
  assert.equal(
    (
      await call(auth, "/api/auth/login", a, {
        email: "migration@example.invalid",
        password: "wrong",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call(auth, "/api/auth/login", a, {
        email: "migration@example.invalid",
        password: "Testing-a-long-password",
      })
    ).status,
    200,
  );
  assert.equal(
    (await call(auth, "/api/auth/me", a, {}, "GET")).data.user.id,
    id,
  );
  const passwordHash = (
    await query("SELECT password_hash FROM user_credentials WHERE user_id=$1", [
      id,
    ])
  ).rows[0].password_hash;
  assert.ok(!passwordHash.includes("Testing-a-long-password"));
  // Constraints catch invalid writes even outside the HTTP handlers.
  await assert.rejects(
    query(
      "UPDATE game_answers SET lower_bound=upper_bound+1 WHERE session_id=$1",
      [game.sessionId],
    ),
  );
});

test.after(async () => {
  await pool.end();
});
