import test from "node:test";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import assert from "node:assert/strict";
import auth from "../api/auth.ts";
import session from "../api/session.ts";
import shareApi from "../api/share.ts";
import { getSharedScore, prepareShare } from "../api/_lib/shares.ts";
import {
  playerIcons,
  normalizeIcon,
  validPlayerColor,
} from "../shared/player-profile.ts";
import { patternFrame } from "../src/components/interval/patterns.ts";
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
    { username: "TestPlayer", icon: "spiral", color: "#355c9b" },
    "2026-09-05",
  );
  assert.ok(share.includes("↻ TestPlayer · Spiral / Cobalt"));
  assert.ok(share.includes("4σ · 2026-09-05"));
  assert.ok(share.endsWith("https://4sig.xyz/"));
  assert.equal(playerIcons.length, 6);
  assert.equal(normalizeIcon("crosshair"), "pendulum");
  assert.equal(normalizeIcon("spark"), "bloom");
  assert.ok(validPlayerColor("#ABC123"));
  assert.equal(validPlayerColor("red; url(evil)"), false);
  for (const pattern of playerIcons)
    for (const phase of [0, 0.125, 0.25, 0.5, 0.75, 1]) {
      const svg = patternFrame(pattern.id, phase);
      assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
      assert.match(svg, /<(?:path|circle|ellipse)/);
    }
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
    query: Object.fromEntries(new URL(path, "http://localhost").searchParams),
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
  if (headers["set-cookie"]) {
    const pair = headers["set-cookie"].split(";")[0],
      name = pair.split("=")[0];
    client.cookie = [
      ...(client.cookie?.split("; ") ?? []).filter(
        (c) => !c.startsWith(name + "="),
      ),
      pair,
    ].join("; ");
  }
  return { status, data, headers };
}

test("Postgres API: profiles, ownership, resume, retries, ranking, credentials", async () => {
  const a: Client = { ip: "one" },
    b: Client = { ip: "two" },
    empty: Client = { ip: "guest" };
  assert.equal((await call(session, "/api/session/answer", empty)).status, 401);
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
  for (const pattern of playerIcons) {
    const saved = await call(auth, "/api/auth/profile", a, {
      avatarIcon: pattern.id,
      avatarColor: "#ABC123",
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.user.avatarIcon, pattern.id);
    assert.equal(saved.data.user.avatarColor, "#abc123");
  }
  assert.equal(
    (
      await call(auth, "/api/auth/profile", a, {
        avatarIcon: "wave",
        avatarColor: "bad",
      })
    ).status,
    400,
  );
  await assert.rejects(prepareShare(id, game.sessionId), /Complete your game/);
  const finished = await Promise.all([
    call(session, "/api/session/finalize", a, { sessionId: game.sessionId }),
    call(session, "/api/session/finalize", a, { sessionId: game.sessionId }),
  ]);
  assert.equal(finished[0].status, 200);
  assert.equal(finished[1].data.score, 10000 * truths.length);
  const shared = finished[0].data.share;
  assert.equal(
    shared.id,
    finished[1].data.share.id,
    "concurrent completion creates one immutable share",
  );
  assert.equal(shared.player.icon, "braid");
  assert.equal(shared.player.color, "#abc123");
  assert.deepEqual(
    shared.hits,
    truths.map(() => true),
  );
  const publicScore = await call(
    shareApi,
    "/api/share?id=" + shared.id,
    empty,
    {},
    "GET",
  );
  assert.equal(publicScore.status, 200);
  assert.equal(publicScore.data.score, 10000 * truths.length);
  assert.deepEqual(Object.keys(publicScore.data).sort(), [
    "edition",
    "hits",
    "id",
    "isRanked",
    "player",
    "score",
  ]);
  assert.deepEqual(Object.keys(publicScore.data.player).sort(), [
    "color",
    "icon",
    "username",
  ]);
  assert.equal(
    (await call(shareApi, "/api/share?id=" + game.sessionId, empty, {}, "GET"))
      .status,
    404,
  );
  assert.equal(
    (await call(shareApi, "/api/share?id=bad", empty, {}, "GET")).status,
    404,
  );
  const otherId = (await call(auth, "/api/auth/me", b, {}, "GET")).data.user.id;
  await assert.rejects(
    prepareShare(otherId, game.sessionId),
    /Complete your game/,
  );
  await call(
    userApi,
    "/api/user/profile",
    a,
    { avatarIcon: "wave", avatarColor: "#795078" },
    "PATCH",
  );
  assert.equal(
    (await call(auth, "/api/auth/me", a, {}, "GET")).data.user.avatarColor,
    "#795078",
  );
  assert.equal(
    (await getSharedScore(shared.id)).player.color,
    "#abc123",
    "old shares retain their original identity",
  );
  assert.deepEqual(
    (await prepareShare(id, game.sessionId)).player,
    shared.player,
  );

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

test("play first: anonymous resume, ownership, final identity, and existing-account attachment", async () => {
  const guest: Client = { ip: "play-first" },
    other: Client = { ip: "other-guest" };
  const before = (await query("SELECT count(*)::int n FROM users")).rows[0].n;
  const first = await call(session, "/api/session/start", guest, {});
  assert.equal(first.status, 200);
  assert.match(first.headers["set-cookie"], /four_sigma_guest=.*HttpOnly/);
  assert.equal(
    (await query("SELECT count(*)::int n FROM users")).rows[0].n,
    before,
    "anonymous play creates no placeholder account",
  );
  assert.equal(
    (await call(auth, "/api/auth/me", guest, {}, "GET")).data.user.isAnonymous,
    true,
  );
  assert.equal(
    (await call(session, "/api/session/start", guest, {})).data.sessionId,
    first.data.sessionId,
  );
  await call(session, "/api/session/start", other, {});
  assert.equal(
    (
      await call(session, "/api/session/answer", other, {
        sessionId: first.data.sessionId,
        questionId: first.data.questions[0].id,
        lower: -1e50,
        upper: 1e50,
      })
    ).status,
    404,
  );
  for (const q of first.data.questions) {
    assert.equal(
      (
        await call(session, "/api/session/answer", guest, {
          sessionId: first.data.sessionId,
          questionId: q.id,
          lower: -1e50,
          upper: 1e50,
        })
      ).status,
      200,
    );
  }
  assert.equal(
    (
      await call(session, "/api/session/finalize", guest, {
        sessionId: first.data.sessionId,
      })
    ).status,
    401,
  );
  assert.equal(
    (await call(session, "/api/session/start", guest, {})).data.judgements
      .length,
    first.data.questions.length,
    "refresh at the identity step preserves every answer",
  );
  const claimed = await call(auth, "/api/auth/claim-username", guest, {
    username: "LateArrival",
  });
  assert.equal(claimed.status, 200);
  assert.equal(
    (
      await call(session, "/api/session/start", guest, {
        resumeId: "------------------------------------",
      })
    ).status,
    200,
  );
  const afterClaimRefresh = await call(session, "/api/session/start", guest, {
    resumeId: first.data.sessionId,
  });
  assert.equal(afterClaimRefresh.data.sessionId, first.data.sessionId);
  assert.equal(
    (await call(session, "/api/session/start", guest, {})).data.sessionId,
    first.data.sessionId,
    "claim-step refresh also works without local storage",
  );
  assert.equal(
    afterClaimRefresh.data.judgements.length,
    first.data.questions.length,
    "refresh after claiming a username keeps the played game",
  );
  assert.equal(
    (
      await call(session, "/api/session/finalize", guest, {
        sessionId: first.data.sessionId,
      })
    ).status,
    409,
    "pattern and color required once before score",
  );
  await call(auth, "/api/auth/profile", guest, {
    avatarIcon: "pendulum",
    avatarColor: "#795078",
  });
  const final = await call(session, "/api/session/finalize", guest, {
    sessionId: first.data.sessionId,
  });
  assert.equal(final.status, 200);
  assert.equal(final.data.isRanked, true);
  assert.equal(final.data.share.player.username, "LateArrival");
  assert.equal(final.data.share.player.icon, "pendulum");
  assert.equal(final.data.judgements.length, first.data.questions.length);
  const ownership = (
    await query(
      "SELECT user_id,guest_session_hash FROM game_sessions WHERE id=$1",
      [first.data.sessionId],
    )
  ).rows[0];
  assert.equal(ownership.user_id, claimed.data.user.id);
  assert.equal(ownership.guest_session_hash, null);
  assert.equal(
    (await call(auth, "/api/auth/me", guest, {}, "GET")).data.user
      .hasPersonality,
    true,
  );
  assert.equal(
    (await call(session, "/api/session/start", guest, {})).data.sessionId,
    first.data.sessionId,
  );
  // A fresh browser can play, then sign in to an account with a ranked game already saved.
  const returning: Client = { ip: "returning-guest" };
  const second = (await call(session, "/api/session/start", returning, {}))
    .data;
  for (const q of second.questions)
    await call(session, "/api/session/answer", returning, {
      sessionId: second.sessionId,
      questionId: q.id,
      lower: -1e50,
      upper: 1e50,
    });
  assert.equal(
    (
      await call(auth, "/api/auth/login", returning, {
        email: "migration@example.invalid",
        password: "Testing-a-long-password",
      })
    ).status,
    200,
  );
  const loginRefresh = await call(session, "/api/session/start", returning, {
    resumeId: second.sessionId,
  });
  assert.equal(loginRefresh.data.sessionId, second.sessionId);
  assert.equal(
    (await call(session, "/api/session/start", returning, {})).data.sessionId,
    second.sessionId,
  );
  assert.equal(loginRefresh.data.isRanked, false);
  const attached = await call(session, "/api/session/finalize", returning, {
    sessionId: second.sessionId,
  });
  assert.equal(attached.status, 200);
  assert.equal(
    attached.data.isRanked,
    false,
    "existing ranked result is preserved; the guest run becomes practice",
  );
  assert.equal(attached.data.judgements.length, second.questions.length);
  assert.equal(
    (await call(auth, "/api/auth/me", returning, {}, "GET")).data.user
      .gamesPlayed,
    1,
  );
});

test.after(async () => {
  await pool.end();
});
