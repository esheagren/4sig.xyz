import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "./_lib/db.js";
export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader("Cache-Control", "no-store");
  try {
    await query("SELECT 1 FROM questions LIMIT 1");
    return res.json({
      status: "ok",
      database: "postgres",
      release: "refined-play-v1",
    });
  } catch {
    return res.status(503).json({ status: "unavailable" });
  }
}
