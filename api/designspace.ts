import { answerInsight } from "./_lib/answer-insights.js";
import { onboardingQuestions } from './_lib/onboarding-data.js';
import { withQuestionCopy } from './_lib/question-copy.js';
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
import { inkExplorations, normalizeInkSeed } from '../shared/ink-exploration.js';
import { inkCollection, inkStyles } from '../shared/ink-collection.js';
import { playerIcons, playerColors } from '../shared/player-profile.js';
import { questionLibrary, questionAnswers } from "./_lib/question-library.js";
import { HttpError, prepare } from "./_lib/http.js";

function loginPage(message = "", view = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Designspace · Four Sigma</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f5f2eb;color:#292936;font:16px/1.5 system-ui,sans-serif;min-height:100svh;display:grid;place-items:center;padding:28px}main{width:100%;max-width:380px}small{font-size:12px;color:#696573;letter-spacing:.12em;text-transform:uppercase}h1{font:400 48px/1.05 Georgia,serif;letter-spacing:-2px;margin:20px 0}p{color:#696573;font-size:14px}label{display:block;margin:32px 0 9px;font-size:14px}input{font:inherit;width:100%;border:1px solid #ccc7d0;border-radius:7px;background:#fffdf8;padding:13px}button{font:inherit;width:100%;padding:14px;border:0;border-radius:7px;background:#4c49b7;color:white;cursor:pointer;margin-top:16px}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #9691e4;outline-offset:4px}.error{min-height:22px;color:#9b314a}a{color:#696573;font-size:13px;display:inline-block;margin-top:22px}
  </style></head><body><main><small>4σ / Private preview</small><h1>Designspace.</h1><p>Explore the current screens, components, and question library.</p><form method="post" action="/designspace${view ? "?view=" + view.replaceAll("&", "&amp;") : ""}"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256" autofocus><button type="submit">Enter designspace →</button><p class="error" role="status">${message}</p></form><a href="/">Back to the game</a></main></body></html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const params = new URL(req.url ?? "/designspace", "https://4sig.xyz")
    .searchParams;
  const view = ["questions", "scorecards", "screen", "archive"].includes(params.get("view") ?? "") ? params.get("view")! : "";
  const returnParams = new URLSearchParams();
  if (view === 'screen' && /^[a-z0-9-]{1,40}$/.test(params.get('screen') ?? '')) returnParams.set('screen', params.get('screen')!);
  const exploring = params.get('mode') === 'explore' || (params.has('seed') && params.get('mode') !== 'collection');
  if (view === 'scorecards') {
    if (params.has('seed')) returnParams.set('seed', normalizeInkSeed(params.get('seed')));
    if (params.has('name')) returnParams.set('name', (params.get('name') ?? '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20));
    if (playerColors.some(color => color.value === params.get('color'))) returnParams.set('color', params.get('color')!);
  }
  if (view === 'scorecards' && ['explore', 'collection'].includes(params.get('mode') ?? '')) returnParams.set('mode', params.get('mode')!);
  if (view === 'scorecards' && inkStyles.some(style => style.id === params.get('style'))) returnParams.set('style', params.get('style')!);
  const returnView = view + (returnParams.size ? '&' + returnParams.toString() : '');
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
    `default-src 'none'; script-src 'nonce-${nonce}'${view !== 'archive' && view !== 'questions' ? " 'self'" : ''}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src ${view === 'screen' ? "'none'" : "'self'"}; img-src 'self' data: blob:; worker-src 'self'; frame-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors ${view === 'screen' ? "'self'" : "'none'"}`,
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
            returnView,
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
          .send(loginPage("That password didn’t match. Try again.", returnView));
      res.setHeader("Set-Cookie", cookie(designToken(secret), DESIGN_TTL));
      return res.redirect(
        303,
        view ? "/designspace?view=" + returnView : "/designspace",
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
      return res.status(200).send(loginPage("", returnView));
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
          : view === "scorecards" ? "api/_lib/scorecard-studies.html" : view === "archive" ? "api/_lib/designspace-archive.html" : "api/_lib/designspace.html",
      ),
      "utf8",
    ).replaceAll("__NONCE__", nonce);
    if (!view || view === 'screen') {
      const bootstrap = process.env.NODE_ENV === 'production'
        ? "import('/assets/designspace.js');"
        : "import('/@react-refresh').then(({default: runtime}) => { runtime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true; return import('/src/designspace.tsx'); });";
      page = page.replace('__DESIGNSPACE_BOOTSTRAP__', bootstrap)
        .replace('__PREVIEW_DATA__', JSON.stringify(view === 'screen' ? onboardingQuestions.map(question => ({ ...withQuestionCopy(question), answerInsight: answerInsight(question.id) })) : []).replaceAll('<', '\\u003c'));
    }
    if (view === 'scorecards') {
      const bootstrap = process.env.NODE_ENV === 'production'
        ? "import('/assets/designspace-scorecards.js');"
        : "import('/@react-refresh').then(({default: runtime}) => { runtime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true; return import('/src/designspace-scorecards.tsx'); });";
      page = page.replace('__SCORECARD_BOOTSTRAP__', bootstrap);
      const name = (params.get('name') ?? 'erik').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
      const color = playerColors.find(color => color.value === params.get('color'))?.value;
      const cards = exploring ? inkExplorations(normalizeInkSeed(params.get('seed')), name, color) : inkCollection(name, color);
      page = page.replace('__STUDY_TITLE__', exploring ? 'Six ways to be yourself.' : 'Eight styles. One signature.')
        .replace('__STUDY_INTRO__', exploring ? 'The original seeded explorations. Shuffle into another combination, or return to the curated collection.' : 'A family of eight compositions with one mark, one type system, and a shared color palette. Pick a pattern, then make it yours.')
        .replace('__OTHER_STUDY_URL__', exploring ? '/designspace?view=scorecards' : '/designspace?view=scorecards&amp;mode=explore')
        .replace('__OTHER_STUDY_LABEL__', exploring ? 'Eight-style collection' : 'Seed explorations');
      page = page.replace('__INK_EXPLORATIONS__', cards.map((card, index) => `<article><h2>${String(index + 1).padStart(2, '0')} · ${exploring ? playerIcons[index].label : inkStyles[index].name}</h2><p class="study-description">${exploring ? card.design!.surface + ' · ' + card.design!.layout : inkStyles[index].description}</p><div class="static-card">${scorecardSvg(card)}</div></article>`).join(''));
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
          returnView,
        ),
      );
  }
}
