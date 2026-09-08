import type { PoolClient } from "pg";
import { query } from "./db.js";
import { annotateQuestion, type GlossaryLink } from "../../src/lib/glossary.js";

/** Definitions are live editorial metadata, never part of a scored answer snapshot. */
export async function withGlossary<T extends { id: string; prompt: string }>(
  questions: T[],
  client?: PoolClient,
) {
  if (!questions.length) return [];
  const run = client ? client.query.bind(client) : query;
  const { rows } = await run(
    `SELECT l.question_id, l.match_text AS "matchText",
    t.id AS "termId", t.title, t.definition FROM question_glossary l
    JOIN glossary_terms t ON t.id=l.term_id WHERE l.question_id=ANY($1::uuid[])`,
    [questions.map((q) => q.id)],
  );
  const links = new Map<string, GlossaryLink[]>();
  for (const row of rows)
    links.set(row.question_id, [
      ...(links.get(row.question_id) ?? []),
      row as GlossaryLink,
    ]);
  return questions.map((q) => ({
    ...q,
    glossary: annotateQuestion(q.prompt, links.get(q.id) ?? []),
  }));
}
