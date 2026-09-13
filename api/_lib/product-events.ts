import type { VercelRequest } from "@vercel/node";
import { getAuthUser } from "./auth.js";
import { guestOwner } from "./guests.js";
import { transaction } from "./db.js";
import { HttpError } from "./http.js";
import { uuid } from "./admin-questions.js";
const names = new Set([
  "screen_view",
  "screen_exit",
  "claim_attempt",
  "claim_result",
  "share_attempt",
  "share_result",
  "flow_error",
]);
const screens = new Set([
  "welcome",
  "practice-estimate",
  "practice-range",
  "practice-revealed",
  "scoring",
  "worldview",
  "identity",
  "estimate",
  "range",
  "revealed",
  "complete",
]);
const outcomes = new Set([
  "success",
  "failed",
  "network",
  "copied",
  "copied-gif",
  "copied-text",
  "unavailable",
]);
export async function recordEvents(req: VercelRequest) {
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); }
    catch { throw new HttpError(400, "Invalid event batch."); }
  }
  if (
    !body ||
    JSON.stringify(body).length > 30000 ||
    !uuid(body.visitorId) ||
    !uuid(body.visitId) ||
    !Array.isArray(body.events) ||
    body.events.length > 20
  )
    throw new HttpError(400, "Invalid event batch.");
  const auth = await getAuthUser(req),
    guest = await guestOwner(req);
  const ua = String(req.headers["user-agent"] ?? "");
  const browser = /Edg/.test(ua)
    ? "Edge"
    : /Firefox|FxiOS/.test(ua)
      ? "Firefox"
      : /Chrome|CriOS/.test(ua)
        ? "Chrome"
        : /Safari/.test(ua)
          ? "Safari"
          : "Other";
  const device = /iPad|Tablet/.test(ua)
    ? "Tablet"
    : /Mobile|Android|iPhone/.test(ua)
      ? "Phone"
      : "Desktop";
  let referrer: string | null = null;
  try {
    const url = new URL(body.referrer);
    if (["https:", "http:"].includes(url.protocol))
      referrer = url.hostname.slice(0, 200);
  } catch {
    /* No referrer is normal. */
  }
  await transaction(async (client) => {
    for (const event of body.events) {
      if (!event || !uuid(event.id) || !names.has(event.name))
        throw new HttpError(400, "Unknown event.");
      const properties: Record<string, string | number> = {};
      const p = event.properties ?? {};
      if (outcomes.has(p.outcome)) properties.outcome = p.outcome;
      if (
        [
          "session/start",
          "session/answer",
          "session/finalize",
          "claim-username",
        ].includes(p.action)
      )
        properties.action = p.action;
      if (Number.isInteger(p.status) && p.status >= 0 && p.status <= 599)
        properties.status = p.status;
      if (Number.isInteger(p.position) && p.position >= 1 && p.position <= 10)
        properties.position = p.position;
      if (typeof p.activeMs === "number" && Number.isFinite(p.activeMs))
        properties.activeMs = Math.round(
          Math.max(0, Math.min(p.activeMs, 3600000)),
        );
      let sessionId: string | null = null,
        questionId: string | null = null;
      if (uuid(p.sessionId)) {
        const owned = await client.query(
          "SELECT id FROM game_sessions WHERE id=$1 AND (user_id=$2 OR guest_session_hash=$3)",
          [p.sessionId, auth?.userId ?? null, guest?.slice(6) ?? null],
        );
        if (owned.rowCount) sessionId = p.sessionId;
      }
      if (
        sessionId &&
        uuid(p.questionId) &&
        (
          await client.query(
            "SELECT 1 FROM game_questions WHERE session_id=$1 AND question_id=$2",
            [sessionId, p.questionId],
          )
        ).rowCount
      )
        questionId = p.questionId;
      await client.query(
        `INSERT INTO product_events(id,visitor_id,visit_id,user_id,session_id,question_id,name,screen,properties,browser,device,referrer_host,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,clock_timestamp()) ON CONFLICT(id) DO NOTHING`,
        [
          event.id,
          body.visitorId,
          body.visitId,
          auth?.userId ?? null,
          sessionId,
          questionId,
          event.name,
          screens.has(event.screen) ? event.screen : null,
          JSON.stringify(properties),
          browser,
          device,
          referrer,
        ],
      );
    }
  });
  return { accepted: true };
}
