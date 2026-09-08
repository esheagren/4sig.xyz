import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pool, transaction } from "../../api/_lib/db.js";
const backup = process.argv[2];
if (!backup)
  throw new Error(
    "Usage: tsx scripts/postgres/migrate.ts /absolute/path/to/export",
  );
const manifest = JSON.parse(await readFile(backup + "/manifest.json", "utf8"));
const exported: Record<string, Record<string, unknown>[]> = {};
for (const [table, info] of Object.entries(manifest.tables) as Array<
  [string, { sha256: string; rows: number }]
>) {
  const raw = await readFile(`${backup}/${table}.json`, "utf8");
  if (createHash("sha256").update(raw).digest("hex") !== info.sha256)
    throw new Error("Backup checksum mismatch: " + table);
  exported[table] = JSON.parse(raw);
  if (exported[table].length !== info.rows)
    throw new Error("Backup count mismatch: " + table);
}
try {
  // Refuse accidental import into a populated application database (including Supabase).
  const { rows } = await pool.query(
    "SELECT to_regclass('public.users') existing",
  );
  if (rows[0].existing)
    throw new Error(
      "Target is not empty. Refusing to overwrite an existing schema.",
    );
  const schema = await readFile(
    new URL("./001_schema.sql", import.meta.url),
    "utf8",
  );
  const identitySchema = await readFile(
    new URL("./002_player_identity.sql", import.meta.url),
    "utf8",
  );
  const guestSchema = await readFile(
    new URL("./003_play_first.sql", import.meta.url),
    "utf8",
  );
  const editorialSchema = await readFile(
    new URL("./005_editorial.sql", import.meta.url),
    "utf8",
  );
  await transaction(async (client) => {
    await client.query(schema.replace(/^BEGIN;|^COMMIT;/gm, ""));
    await client.query(identitySchema.replace(/^BEGIN;|^COMMIT;/gm, ""));
    await client.query(guestSchema.replace(/^BEGIN;|^COMMIT;/gm, ""));
    await client.query(editorialSchema.replace(/^BEGIN;|^COMMIT;/gm, ""));
    for (const [table, data] of Object.entries(exported)) {
      await client.query(
        "INSERT INTO legacy.supabase_exports(table_name,exported_at,row_count,sha256,rows) VALUES($1,$2,$3,$4,$5)",
        [
          table,
          manifest.createdAt,
          data.length,
          manifest.tables[table].sha256,
          JSON.stringify(data),
        ],
      );
    }
    const columns: Record<string, string[]> = {
      domains: ["id", "name", "slug"],
      categories: ["id", "domain_id", "name", "slug"],
      subcategories: ["id", "category_id", "name", "slug"],
      units: ["id", "name", "symbol"],
      questions: [
        "id",
        "unit_id",
        "question_text",
        "answer_value",
        "answer_context",
        "source_url",
        "source_name",
        "is_active",
        "usage_type",
        "created_at",
        "updated_at",
      ],
      question_subcategories: ["question_id", "subcategory_id", "is_primary"],
      daily_questions: [
        "id",
        "question_id",
        "date",
        "display_order",
        "is_published",
      ],
    };
    for (const [table, fields] of Object.entries(columns)) {
      for (const record of exported[table]) {
        // The ten imported zero values are unfinished research, not playable answers.
        const row = { ...record };
        if (table === "questions" && Number(row.answer_value) === 0)
          row.is_active = false;
        await client.query(
          `INSERT INTO ${table}(${fields.join(",")}) VALUES(${fields.map((_, i) => "$" + (i + 1)).join(",")})`,
          fields.map((f) => row[f] ?? null),
        );
      }
    }
    // Preserve edition length/order while replacing unfinished questions with valid ones.
    const { rows: invalid } = await client.query(
      `SELECT d.id,d.date::text FROM daily_questions d JOIN questions q ON q.id=d.question_id WHERE NOT q.is_active`,
    );
    for (const row of invalid) {
      await client.query(
        `UPDATE daily_questions SET question_id=(SELECT q.id FROM questions q WHERE q.is_active AND q.usage_type='daily'
        AND NOT EXISTS(SELECT 1 FROM daily_questions d WHERE d.date=$2::date AND d.question_id=q.id)
        ORDER BY md5(q.id::text||$2) LIMIT 1) WHERE id=$1`,
        [row.id, row.date],
      );
    }
    for (const [table, records] of Object.entries(exported)) {
      const { rows: check } = await client.query(
        "SELECT row_count,jsonb_array_length(rows) actual FROM legacy.supabase_exports WHERE table_name=$1",
        [table],
      );
      if (
        check[0].actual !== records.length ||
        check[0].row_count !== records.length
      )
        throw new Error("Archive verification failed: " + table);
    }
  });
  const { rows: counts } =
    await pool.query(`SELECT (SELECT count(*) FROM questions)::int questions,(SELECT count(*) FROM questions WHERE is_active)::int playable_questions,
    (SELECT count(*) FROM daily_questions)::int scheduled_questions,(SELECT sum(row_count) FROM legacy.supabase_exports)::int archived_rows,(SELECT count(*) FROM users)::int live_users`);
  console.log(
    JSON.stringify({
      imported: counts[0],
      archiveTables: Object.keys(exported).length,
    }),
  );
} finally {
  await pool.end();
}
