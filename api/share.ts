import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prepare, fail, requireMethod } from "./_lib/http.js";
import { getSharedScore } from "./_lib/shares.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!prepare(req, res)) return;
    requireMethod(req, "GET");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    return res.json(await getSharedScore(req.query.id));
  } catch (error) {
    return fail(res, error);
  }
}
