import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pool } from "../api/_lib/db.ts";
import { withGlossary } from "../api/_lib/glossary.ts";
import { annotateQuestion } from "../src/lib/glossary.ts";
import { readGame } from "../api/_lib/session-storage.ts";
const term = (matchText: string, termId = matchText) => ({
  termId,
  matchText,
  title: termId,
  definition: "A short explanation.",
});

test("annotations match complete phrases without changing text, prefer longer terms, and escape punctuation", () => {
  const text = "Genes, genomes, GENOME and human genome: C++?";
  const spans = annotateQuestion(text, [
    term("genome"),
    term("human genome"),
    term("C++"),
  ]);
  assert.deepEqual(
    spans.map((s) => text.slice(s.start, s.end)),
    ["GENOME", "human genome", "C++"],
  );
  assert.deepEqual(
    annotateQuestion("A legacy prompt", [term("genome"), term("")]),
    [],
  );
  assert.equal(
    annotateQuestion("genome genome", [
      term("genome"),
      term("genome", "duplicate"),
    ]).length,
    2,
  );
  assert.equal(annotateQuestion("égenome genomeé", [term("genome")]).length, 0);
});

test("glossary copy stays within two sentences and a single phone screen", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../editorial/glossary.json", import.meta.url),
      "utf8",
    ),
  );
  const ids = new Set();
  for (const term of manifest.terms) {
    assert.ok(!ids.has(term.id));
    ids.add(term.id);
    assert.ok(term.definition.length <= 450);
    assert.ok(term.definition.split(/\s+/).length <= 65);
    const sentences = [
      ...new Intl.Segmenter("en", { granularity: "sentence" }).segment(
        term.definition,
      ),
    ];
    assert.ok(sentences.length >= 1 && sentences.length <= 2, term.id);
    assert.equal(new URL(term.sourceUrl).protocol, "https:");
  }
  for (const link of manifest.links) assert.ok(ids.has(link.termId));
  assert.match(
    manifest.terms.find((t) => t.id === "gini-coefficient").definition,
    /made-up/,
  );
  assert.match(
    manifest.terms.find((t) => t.id === "market-exchange-rate").definition,
    /made-up/,
  );
});

test("shared definitions reach saved games without exposing answers or rewriting snapshots", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      rows: [q],
    } = await client.query(
      "INSERT INTO questions(question_text,answer_value) VALUES('What is the genome cost?',987654) RETURNING id",
    );
    await client.query(
      "INSERT INTO glossary_terms(id,title,definition,source_url,verified_at) VALUES('test-genome','Genome','The full set of DNA instructions.','https://example.org','2026-09-08')",
    );
    await client.query(
      "INSERT INTO question_glossary VALUES($1,'test-genome','genome')",
      [q.id],
    );
    const {
      rows: [user],
    } = await client.query(
      "INSERT INTO users(username) VALUES('glossary_test') RETURNING id",
    );
    const {
      rows: [game],
    } = await client.query(
      "INSERT INTO game_sessions(user_id,edition,is_ranked) VALUES($1,'2040-01-01',false) RETURNING id",
      [user.id],
    );
    const snapshot = {
      id: q.id,
      prompt: "What was a GENOME?",
      trueValue: 987654,
      answerContext: "SECRET ANSWER",
    };
    await client.query(
      "INSERT INTO game_questions(session_id,question_id,position,snapshot) VALUES($1,$2,0,$3)",
      [game.id, q.id, JSON.stringify(snapshot)],
    );
    const first = await readGame(game.id, user.id, client);
    assert.equal(first.questions[0].glossary.length, 1);
    assert.equal(first.questions[0].prompt, snapshot.prompt);
    assert.doesNotMatch(
      JSON.stringify(first),
      /987654|SECRET ANSWER|source_url/,
    );
    await client.query(
      "UPDATE glossary_terms SET definition='Updated shared explanation.' WHERE id='test-genome'",
    );
    const updated = await withGlossary(
      [
        { id: q.id, prompt: "What is a genome?" },
        { id: q.id, prompt: "Legacy wording with no match" },
      ],
      client,
    );
    assert.equal(
      updated[0].glossary[0].definition,
      "Updated shared explanation.",
    );
    assert.deepEqual(updated[1].glossary, []);
    const {
      rows: [stored],
    } = await client.query(
      "SELECT snapshot FROM game_questions WHERE session_id=$1",
      [game.id],
    );
    assert.deepEqual(stored.snapshot, snapshot);
    assert.equal(
      (await readGame(game.id, user.id, client)).questions[0].glossary[0]
        .definition,
      "Updated shared explanation.",
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
