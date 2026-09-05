import type { VercelRequest, VercelResponse } from "@vercel/node";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function prepare(req: VercelRequest, res: VercelResponse): boolean {
  res.setHeader("Cache-Control", "no-store");
  // Cookie credentials are same-origin only. Reject cross-site writes, including login CSRF.
  const origin = req.headers.origin;
  const host = req.headers.host;
  let originMatches = !origin;
  if (origin) {
    try {
      originMatches = new URL(origin).host === host?.toLowerCase();
    } catch {
      originMatches = false;
    }
  }
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method || "") &&
    (req.headers["sec-fetch-site"] === "cross-site" || !originMatches)
  ) {
    res.status(403).json({ error: "Request must come from this site." });
    return false;
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return false;
  }
  return true;
}
export function fail(res: VercelResponse, error: unknown) {
  if (error instanceof HttpError)
    return res.status(error.status).json({ error: error.message });
  if ((error as { code?: string })?.code === "23505")
    return res
      .status(409)
      .json({ error: "That username or email is already in use." });
  console.error(
    "API request failed",
    error instanceof Error ? error.message : "Unknown error",
  );
  return res.status(503).json({ error: "Could not save. Please try again." });
}
export function requireMethod(req: VercelRequest, method: string) {
  if (req.method !== method) throw new HttpError(405, "Method not allowed");
}
