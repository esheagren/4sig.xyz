import "dotenv/config";
import { readFile } from "node:fs/promises";
import { pool, transaction } from "../../api/_lib/db.js";
import { annotateQuestion } from "../../src/lib/glossary.js";
const manifest = JSON.parse(
  await readFile(
    new URL("../../editorial/glossary.json", import.meta.url),
    "utf8",
  ),
) as {
  verifiedAt: string;
  terms: { id: string; title: string; definition: string; sourceUrl: string }[];
  links: { questionId: string; termId: string; matchText: string }[];
};
try {
  const schema = await readFile(
    new URL("./006_glossary.sql", import.meta.url),
    "utf8",
  );
  await transaction(async (client) => {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('editorial-bank'))",
    );
    await client.query(schema.replace(/^BEGIN;|^COMMIT;/gm, ""));
    for (const t of manifest.terms) {
      // Decimal points are not sentence boundaries. Keep copy short enough for a phone.
      const sentences = [
        ...new Intl.Segmenter("en", { granularity: "sentence" }).segment(
          t.definition,
        ),
      ];
      if (
        sentences.length > 2 ||
        t.definition.length > 450 ||
        t.definition.split(/\s+/).length > 65
      )
        throw new Error(`Definition too long: ${t.id}`);
      if (new URL(t.sourceUrl).protocol !== "https:")
        throw new Error(`Invalid source: ${t.id}`);
      await client.query(
        `INSERT INTO glossary_terms(id,title,definition,source_url,verified_at) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title,definition=excluded.definition,
        source_url=excluded.source_url,verified_at=excluded.verified_at,updated_at=now()`,
        [t.id, t.title, t.definition, t.sourceUrl, manifest.verifiedAt],
      );
    }
    for (const link of manifest.links) {
      const { rows } = await client.query(
        "SELECT question_text FROM questions WHERE id=$1",
        [link.questionId],
      );
      const term = manifest.terms.find((t) => t.id === link.termId);
      if (
        !term ||
        !rows[0] ||
        !annotateQuestion(rows[0].question_text, [{ ...link, ...term }]).length
      )
        throw new Error(
          `Glossary link does not match question: ${link.questionId} / ${link.termId}`,
        );
      await client.query(
        `INSERT INTO question_glossary(question_id,term_id,match_text) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
        [link.questionId, link.termId, link.matchText],
      );
    }
  });
  console.log(
    JSON.stringify({
      terms: manifest.terms.length,
      links: manifest.links.length,
    }),
  );
} finally {
  await pool.end();
}
