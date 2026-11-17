import test from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import { pool } from "../api/_lib/db.ts";
import { questionMaximum } from "../api/_lib/question-limits.ts";
import { question } from "../api/_lib/questions.ts";
import { readGame, saveAnswer } from "../api/_lib/session-storage.ts";
import { initialBounds, fitDomain, resizeBounds, validBounds } from "../src/components/interval/game.ts";
import { startDrag, stepDrag, moveBound } from "../src/components/interval/range-drag.ts";

const share = { id: "42e9ce1c-61b4-4786-8efc-05f223b25849", unit: "%", prompt: "EV share", trueValue: 97.6 };
const sessionId = "11111111-1111-4111-8111-111111111111";

test("share limits use public metadata, preserving unbounded rates and explicit limits", () => {
  assert.equal(questionMaximum(share), 100);
  assert.equal(questionMaximum({ ...share, max: 80 }), 80);
  assert.equal(questionMaximum({ ...share, max: 200 }), 100);
  assert.equal(questionMaximum({ ...share, unit: "cars" }), undefined);
  for (const id of [
    "a740ef6d-81a3-4300-97bb-534fa5aab55f", // Debt-to-GDP
    "43c2da73-9b46-4631-b5c4-dacf9001b5d4", // Inflation
    "edab299a-a721-4c8d-8a6f-255646b05465", // Federal funds rate
    "57b13253-0cb4-4fb9-81d1-632f0e2a71be", // Treasury yield
  ]) assert.equal(questionMaximum({ id, unit: "%" }), undefined);
  assert.equal(questionMaximum({ id: "onboarding", unit: "%", max: 100 }), 100);
  assert.equal(question({ id: share.id, unit: "%", answer_value: 97.6 }).max, 100);
});

test("percentage range creation, widening, dragging and typed bounds stop at 100", () => {
  const max = questionMaximum(share);
  const bounds = initialBounds(90, max, 0);
  assert.equal(bounds.upper, 100);
  assert.equal(resizeBounds(bounds, 100, max, 0).upper, 100);
  assert.equal(fitDomain(bounds, max, 0)[1], 100);
  assert.equal(moveBound(bounds, "upper", 150, 0, max).upper, 100);
  let drag = startDrag(bounds, fitDomain(bounds, max, 0), "upper");
  for (let i = 0; i < 100; i++) drag = stepDrag(drag, 1.2, 0.05, true, 0, max);
  assert.equal(drag.bounds.upper, 100);
  assert.equal(drag.domain[1], 100);
  assert.equal(drag.cue, "Maximum reached");
  assert.equal(validBounds({ ...bounds, upper: 100.01 }, max, 0), false);
  assert.throws(() => initialBounds(101, max, 0));
  assert.equal(initialBounds(200, undefined, 0).upper, 300);
});

test("resumed daily snapshots get the cap and server rejects out-of-range submissions", async (t) => {
  let writes = 0;
  const item = { question_id: share.id, snapshot: { ...share }, lower_bound: null as number | null,
    upper_bound: null as number | null, initial_estimate: 90, score: 0, captured: false };
  const client = {
    async query(sql: string) {
      if (sql.includes("FROM game_sessions")) return { rows: [{ id: sessionId, kind: "daily", completed_at: null }] };
      if (sql.includes("FROM game_questions")) return { rows: [item] };
      if (sql.startsWith("INSERT INTO game_answers")) writes++;
      return { rows: [] };
    },
    release() {},
  };
  t.mock.method(pool, "connect", async () => client);
  const resumed = await readGame(sessionId, "player", client as unknown as PoolClient);
  assert.equal(resumed.questions[0].max, 100);
  assert.equal(resumed.judgements.length, 0);
  for (const [lower, upper] of [[80, 100.01], [-1, 100]]) {
    await assert.rejects(saveAnswer("player", sessionId, share.id, lower, upper, 90), { status: 400 });
  }
  assert.equal(writes, 0);
  assert.equal((await saveAnswer("player", sessionId, share.id, 80, 100, 90)).hit, true);
  assert.equal(writes, 1);
  // Previously locked answers stay immutable and retries remain idempotent.
  item.lower_bound = 80;
  item.upper_bound = 120;
  assert.equal((await saveAnswer("player", sessionId, share.id, 80, 120, 90)).upper, 120);
  assert.equal(writes, 1);
});
