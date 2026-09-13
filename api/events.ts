import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prepare, fail, requireMethod } from "./_lib/http.js";
import { rateLimit } from "./_lib/auth.js";
import { recordEvents } from "./_lib/product-events.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!prepare(req, res)) return;
    requireMethod(req, "POST");
    await rateLimit(req, "product-events", 300);
    return res.json(await recordEvents(req));
  } catch (error) {
    return fail(res, error);
  }
}
