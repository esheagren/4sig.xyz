import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { rateLimit, verifyPassword } from "./_lib/auth.js";
import {
  DESIGN_COOKIE,
  DESIGN_TTL,
  designToken,
  validDesignToken,
} from "./_lib/designspace-auth.js";
import { scorecardSvg } from '../shared/scorecard.js';
import { questionLibrary, questionAnswers } from "./_lib/question-library.js";
import { HttpError, prepare } from "./_lib/http.js";

function loginPage(message = "", view = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Designspace · Four Sigma</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f5f2eb;color:#292936;font:16px/1.5 system-ui,sans-serif;min-height:100svh;display:grid;place-items:center;padding:28px}main{width:100%;max-width:380px}small{font-size:12px;color:#696573;letter-spacing:.12em;text-transform:uppercase}h1{font:400 48px/1.05 Georgia,serif;letter-spacing:-2px;margin:20px 0}p{color:#696573;font-size:14px}label{display:block;margin:32px 0 9px;font-size:14px}input{font:inherit;width:100%;border:1px solid #ccc7d0;border-radius:7px;background:#fffdf8;padding:13px}button{font:inherit;width:100%;padding:14px;border:0;border-radius:7px;background:#4c49b7;color:white;cursor:pointer;margin-top:16px}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #9691e4;outline-offset:4px}.error{min-height:22px;color:#9b314a}a{color:#696573;font-size:13px;display:inline-block;margin-top:22px}
  </style></head><body><main><small>Four Sigma / Private preview</small><h1>Designspace.</h1><p>Explore design studies and the question bank.</p><form method="post" action="/designspace${view ? "?view=" + view : ""}"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256" autofocus><button type="submit">Enter designspace →</button><p class="error" role="status">${message}</p></form><a href="/">Back to the game</a></main></body></html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const params = new URL(req.url ?? "/designspace", "https://4sig.xyz")
    .searchParams;
  const view = ["questions", "scorecards"].includes(params.get("view") ?? "") ? params.get("view")! : "";
  const questions = view === "questions";
  const data = params.get("data");
  const nonce = randomBytes(18).toString("base64");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Keep the Origin on same-site form posts so the CSRF check can validate them.
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
  );
  try {
    if (!prepare(req, res)) return;
    res.setHeader(
      "Content-Type",
      data ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
    );
    const hash = process.env.DESIGNSPACE_PASSWORD_HASH;
    const secret = process.env.DESIGNSPACE_SESSION_SECRET;
    if (!hash || !secret || secret.length < 32) {
      if (data)
        return res
          .status(503)
          .json({ error: "The question library is unavailable." });
      return res
        .status(503)
        .send(
          loginPage(
            "The preview is being prepared. Please try again shortly.",
            view,
          ),
        );
    }
    if (!["GET", "HEAD", "POST"].includes(req.method ?? "")) {
      res.setHeader("Allow", "GET, HEAD, POST");
      return res.status(405).end();
    }
    if (data && req.method !== "GET")
      return res
        .status(405)
        .json({ error: "Use GET for the question library." });
    if (req.method === "POST") {
      const body =
        typeof req.body === "string"
          ? Object.fromEntries(new URLSearchParams(req.body))
          : (req.body ?? {});
      const cookie = (value: string, age: number) =>
        `${DESIGN_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
      if (body.action === "logout") {
        res.setHeader("Set-Cookie", cookie("", 0));
        return res.redirect(303, "/designspace");
      }
      await rateLimit(req, "designspace-password", 10);
      if (
        typeof body.password !== "string" ||
        body.password.length > 256 ||
        !(await verifyPassword(body.password, hash))
      )
        return res
          .status(401)
          .send(loginPage("That password didn’t match. Try again.", view));
      res.setHeader("Set-Cookie", cookie(designToken(secret), DESIGN_TTL));
      return res.redirect(
        303,
        view ? "/designspace?view=" + view : "/designspace",
      );
    }
    const token = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(DESIGN_COOKIE + "="))
      ?.slice(DESIGN_COOKIE.length + 1);
    if (!validDesignToken(token, secret)) {
      if (data)
        return res
          .status(401)
          .json({
            error: "Sign in to designspace to view the question library.",
          });
      return res.status(200).send(loginPage("", view));
    }
    if (data === "questions")
      return res.json({ questions: await questionLibrary() });
    if (data === "answers")
      return res.json({
        answers: await questionAnswers((params.get("ids") ?? "").split(",")),
      });
    if (data) return res.status(400).json({ error: "Unknown request." });
    let page = readFileSync(
      join(
        process.cwd(),
        questions
          ? "api/_lib/question-manager.html"
          : view === "scorecards" ? "api/_lib/scorecard-studies.html" : "api/_lib/designspace.html",
      ),
      "utf8",
    ).replaceAll("__NONCE__", nonce);
    if (view === 'scorecards') {
      const sample = { player: { username: 'erik', icon: 'spiral' as const, color: '#276c66' }, score: 1286.4,
        hits: [true, true, false, true, true, true, true, true], label: 'STARTING CALIBRATION' };
      for (const variant of ['paper', 'ink', 'emblem'] as const) page = page.replace(`__CARD_${variant.toUpperCase()}__`, scorecardSvg(sample, variant));
    }
    return res.status(200).send(page);
  } catch (error) {
    if (data)
      return res
        .status(error instanceof HttpError ? error.status : 503)
        .json({
          error:
            error instanceof HttpError
              ? error.message
              : "Could not load questions. Please try again.",
        });
    const limited = error instanceof HttpError && error.status === 429;
    if (limited) res.setHeader("Retry-After", "900");
    return res
      .status(limited ? 429 : 503)
      .send(
        loginPage(
          limited
            ? "Too many attempts. Please try again in 15 minutes."
            : "Could not open the preview. Please try again shortly.",
          view,
        ),
      );
  }
}
