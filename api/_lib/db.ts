import pg from "pg";
import type { PoolClient } from "pg";

const databaseUrl = process.env.DATABASE_URL
  ? new URL(process.env.DATABASE_URL)
  : null;
if (databaseUrl?.searchParams.get("sslmode") === "require")
  databaseUrl.searchParams.set("sslmode", "verify-full");

// Standard pg also supports a local Unix socket for integration tests.
export const pool = new pg.Pool({
  connectionString: databaseUrl?.toString(),
  max: 4,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: true,
});
pool.on("error", (error) =>
  console.error("Database connection error", error.message),
);
export const query = (text: string, values: unknown[] = []) =>
  pool.query(text, values);
export async function transaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
