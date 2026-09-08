import "dotenv/config";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pool } from "../../api/_lib/db.js";
import {
  applyEditorialRelease,
  validateRelease,
  type EditorialRelease,
} from "./editorial-release.js";
const [file, backupDirectory] = process.argv.slice(2);
if (!file || !backupDirectory)
  throw new Error(
    "Usage: tsx scripts/postgres/apply-editorial.ts release.json /absolute/private/backup-directory",
  );
const raw = await readFile(file, "utf8");
const release = JSON.parse(raw) as EditorialRelease;
validateRelease(release);
const client = await pool.connect();
try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('editorial-bank'))",
  );
  await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
  for (const table of ["questions", "daily_questions", "editorial_releases"]) {
    const { rows } = await client.query(`SELECT * FROM ${table} ORDER BY id`);
    await writeFile(
      `${backupDirectory}/${table}.json`,
      JSON.stringify(rows, null, 2),
      { flag: "wx", mode: 0o600 },
    );
  }
  const result = await applyEditorialRelease(
    client,
    release,
    createHash("sha256").update(raw).digest("hex"),
  );
  await client.query("COMMIT");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
