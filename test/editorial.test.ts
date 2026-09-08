import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pool } from "../api/_lib/db.ts";
import { scheduleEdition, pacificDate } from "../api/_lib/questions.ts";
import {
  applyEditorialRelease,
  validateRelease,
  type EditorialRelease,
  type EditorialQuestion,
} from "../scripts/postgres/editorial-release.ts";

test("reviewed manifest has evidence for every admitted question and retains an explicit backlog", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../editorial/releases/2026-09-08.json", import.meta.url),
      "utf8",
    ),
  );
  validateRelease(manifest);
  assert.equal(manifest.questions.length, 109);
  assert.equal(
    manifest.questions.filter(
      (q: EditorialQuestion) => q.editorial_status === "ready",
    ).length,
    24,
  );
  assert.equal(
    manifest.questions.filter(
      (q: EditorialQuestion) => q.editorial_status === "needs_review",
    ).length,
    42,
  );
  assert.equal(
    manifest.questions.filter(
      (q: EditorialQuestion) => q.editorial_status === "retired",
    ).length,
    43,
  );
  const duplicate = structuredClone(manifest);
  duplicate.questions.push(duplicate.questions[0]);
  assert.throws(() => validateRelease(duplicate), /duplicate/);
  const invalid = structuredClone(manifest);
  invalid.questions.find(
    (q: EditorialQuestion) => q.editorial_status === "ready",
  ).source_url = "javascript:bad";
  assert.throws(() => validateRelease(invalid), /source/);
});

test("editorial release preserves games and today, repairs future schedules, balances topics, expires evidence, and is idempotent", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('editorial-bank'))",
    );
    const today = pacificDate();
    // Work entirely in a rolled-back transaction; other API tests see their original fixtures.
    await client.query("DELETE FROM daily_questions");
    const originals = (await client.query("SELECT * FROM questions")).rows;
    const release: EditorialRelease = { id: "editorial-test", questions: [] };
    for (const r of originals)
      release.questions.push({
        id: r.id,
        audit_number: 0,
        editorial_status: "retired",
        editorial_role: "core",
        editorial_topic: "Fixture",
        verification_notes: "Test retired",
        expected: {
          question_text: r.question_text,
          answer_value: r.answer_value,
          source_url: r.source_url,
          answer_context: r.answer_context,
          unit_id: r.unit_id,
        },
      });
    const seed = [];
    for (let i = 0; i < 10; i++) {
      const r = (
        await client.query(
          "INSERT INTO questions(question_text,answer_value) VALUES($1,100) RETURNING *",
          ["Unreviewed " + i],
        )
      ).rows[0];
      seed.push(r);
      release.questions.push({
        id: r.id,
        audit_number: i + 1,
        editorial_status: "ready",
        editorial_role: i < 8 ? "core" : "reference",
        editorial_topic: "Topic " + (i % 4),
        verification_notes: "Verified test observation",
        expected: {
          question_text: r.question_text,
          answer_value: r.answer_value,
          source_url: r.source_url,
          answer_context: r.answer_context,
          unit_id: r.unit_id,
        },
        question_text: "Reviewed " + i,
        answer_value: 200 + i,
        unit_name: "genes",
        observation_period: "2024",
        geography: "World",
        measure_definition: "Test count",
        source_name: "Test primary source",
        source_url: "https://example.org/data",
        answer_context: "A meaningful reference.",
        verified_at: "2020-01-01",
        review_due: "2099-12-31",
      });
    }
    for (let i = 0; i < 4; i++)
      await client.query(
        "INSERT INTO daily_questions(question_id,date,display_order) VALUES($1,$2,$3)",
        [seed[i].id, today, i],
      );
    await client.query(
      "INSERT INTO daily_questions(question_id,date,display_order) VALUES($1,$2::date+1,0)",
      [originals[0].id, today],
    );
    const user = (
      await client.query(
        "INSERT INTO users(username) VALUES('EditorialTestUser') RETURNING id",
      )
    ).rows[0];
    const session = (
      await client.query(
        "INSERT INTO game_sessions(user_id,edition,is_ranked) VALUES($1,$2,true) RETURNING id",
        [user.id, today],
      )
    ).rows[0];
    const oldSnapshot = {
      id: seed[0].id,
      prompt: "Unreviewed 0",
      trueValue: 100,
      sourceUrl: "https://example.org/old",
    };
    await client.query(
      "INSERT INTO game_questions(session_id,question_id,position,snapshot) VALUES($1,$2,0,$3)",
      [session.id, seed[0].id, JSON.stringify(oldSnapshot)],
    );
    await client.query(
      "INSERT INTO game_answers(session_id,question_id,lower_bound,upper_bound,score,captured) VALUES($1,$2,90,110,500,true)",
      [session.id, seed[0].id],
    );
    const result = await applyEditorialRelease(
      client,
      release,
      "test-sha",
      today,
    );
    assert.equal(result.alreadyApplied, false);
    const repaired = (
      await client.query(
        "SELECT q.answer_value,u.name unit FROM questions q JOIN units u ON u.id=q.unit_id WHERE q.id=$1",
        [seed[0].id],
      )
    ).rows[0];
    assert.equal(Number(repaired.answer_value), 200);
    assert.equal(repaired.unit, "genes");
    assert.equal(
      Number(
        (await client.query("SELECT count(*) FROM units WHERE name='genes'"))
          .rows[0].count,
      ),
      1,
    );
    assert.deepEqual(
      (
        await client.query(
          "SELECT snapshot FROM game_questions WHERE session_id=$1",
          [session.id],
        )
      ).rows[0].snapshot,
      oldSnapshot,
    );
    const frozen = await scheduleEdition(client, today);
    assert.equal(frozen.length, 4);
    assert.equal(frozen[0].trueValue, 100);
    assert.equal(frozen[0].prompt, "Unreviewed 0");
    const nextDate = (
      await client.query("SELECT ($1::date+1)::text date", [today])
    ).rows[0].date;
    const next = await scheduleEdition(client, nextDate);
    assert.equal(next.length, 4);
    assert.ok(next.every((q) => q.prompt.startsWith("Reviewed")));
    assert.ok(next.every((q) => q.unit === "genes"));
    const chosen = (
      await client.query(
        "SELECT editorial_role,editorial_topic FROM questions WHERE id=ANY($1::uuid[])",
        [next.map((q) => q.id)],
      )
    ).rows;
    assert.ok(
      chosen.filter((q) => q.editorial_role === "reference").length <= 1,
    );
    assert.equal(new Set(chosen.map((q) => q.editorial_topic)).size, 4);
    assert.deepEqual(
      await applyEditorialRelease(client, release, "test-sha", today),
      { alreadyApplied: true },
    );
    await assert.rejects(
      () => applyEditorialRelease(client, release, "different-sha", today),
      /checksum/,
    );
    // Expiry only changes an unstarted edition; frozen editions retain their original facts.
    await client.query(
      "UPDATE questions SET review_due='2021-01-01' WHERE id=ANY($1::uuid[])",
      [next.map((q) => q.id)],
    );
    const revised = await scheduleEdition(client, nextDate);
    assert.equal(revised.length, 4);
    assert.ok(revised.every((q) => !next.some((old) => old.id === q.id)));
    assert.deepEqual(await scheduleEdition(client, today), frozen);
    await client.query(
      "UPDATE questions SET review_due='2021-01-01' WHERE editorial_status='ready'",
    );
    await assert.rejects(() => scheduleEdition(client, nextDate), /not ready/);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
