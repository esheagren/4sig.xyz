import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import dotenv from "dotenv";
const envFile = process.argv[2];
if (!envFile) throw new Error("Pass the target environment file.");
const loaded = dotenv.config({ path: envFile, override: true, quiet: true });
if (!loaded.parsed?.DATABASE_URL)
  throw new Error("Target file must contain DATABASE_URL.");
if (!new URL(loaded.parsed.DATABASE_URL).hostname.endsWith(".neon.tech"))
  throw new Error("Expected a Neon target; refusing another provider.");
const { pool } = await import("../../api/_lib/db.js");
try {
  const counts = () =>
    pool.query(
      "SELECT (SELECT count(*)::int FROM users) profiles,(SELECT count(*)::int FROM game_sessions) sessions,(SELECT count(*)::int FROM game_answers) answers",
    );
  const before = (await counts()).rows[0];
  for (const file of ["./002_player_identity.sql", "./003_play_first.sql"])
    await pool.query(await readFile(new URL(file, import.meta.url), "utf8"));
  assert.deepEqual((await counts()).rows[0], before);
  const { rows } = await pool.query(
    "SELECT count(*)::int n FROM users WHERE avatar_color !~ '^#[0-9a-fA-F]{6}$'",
  );
  assert.equal(rows[0].n, 0);
  console.log(
    "Identity upgrade applied; existing profile, session and answer counts unchanged.",
  );
} finally {
  await pool.end();
}
