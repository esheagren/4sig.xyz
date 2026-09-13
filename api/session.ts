import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser, getAuthUser, getUserById } from "./_lib/auth.js";
import { getDailyQuestions, pacificDate } from "./_lib/questions.js";
import {
  startGame,
  saveAnswer,
  finishGame,
  readGame,
} from "./_lib/session-storage.js";
import {
  getDailyStats,
  getPerformanceHistory,
  getOverallLeaderboard,
} from "./_lib/sessions.js";
import { HttpError, prepare, fail, requireMethod } from "./_lib/http.js";
import {
  guestOwner,
  attachGuestGame,
  guestGameForEdition,
} from "./_lib/guests.js";
import { onboardingForOwner, isFirstVisit } from './_lib/onboarding.js';
import { prepareShare } from "./_lib/shares.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!prepare(req, res)) return;
    const action = req.url?.split("?")[0].split("/").pop();
    if (action === "leaderboard") {
      requireMethod(req, "GET");
      return res.json({ leaderboard: await getOverallLeaderboard() });
    }
    requireMethod(req, "POST");
    const auth = await getAuthUser(req),
      body = req.body ?? {};
    const owner =
      auth?.userId ??
      (await guestOwner(req, action === "start" ? res : undefined));
    if (!owner) throw new HttpError(401, "Start a game first.");
    if (action === "start") {
      const edition = pacificDate();
      // Old scorecards remain reviewable, but this link never creates a baseline.
      if (body.onboarding === true && !body.practice) {
        const baseline = await onboardingForOwner(owner);
        if (baseline) return res.json({ ...await readGame(baseline.id, owner), showIntro: false, dailyAvailable: true });
      }
      if (!body.practice) {
        const guest = auth ? await guestOwner(req) : null;
        const candidates = new Set([
          body.resumeId,
          auth ? await guestGameForEdition(guest, edition, auth.userId) : null,
        ]);
        for (const id of candidates) {
          if (!id) continue;
          if (auth) await attachGuestGame(auth.userId, id, guest);
          try {
            const resumed = await readGame(id, owner);
            // Preserve answers already given, including a pending claim across midnight.
            const legacyInProgress = resumed.kind === 'onboarding' && resumed.savedAnswers.length > 0;
            const dailyInProgress = resumed.kind === 'daily' && (resumed.edition === edition || resumed.savedAnswers.length === resumed.questions.length);
            if (!resumed.completed && (legacyInProgress || dailyInProgress))
              return res.json({ ...resumed, showIntro: !legacyInProgress && await isFirstVisit(owner, resumed.sessionId), dailyAvailable: legacyInProgress });
          } catch (error) {
            if (!(error instanceof HttpError && error.status === 404)) throw error;
          }
        }
      }
      const questions = await getDailyQuestions(edition);
      if (!questions.length) throw new HttpError(503, "Today's numbers are not ready yet.");
      const game = await startGame(owner, edition, questions, body.practice === true);
      return res.json({ ...game, showIntro: !body.practice && await isFirstVisit(owner, game.sessionId) });
    }
    if (action === "answer") {
      const judgement = await saveAnswer(owner, body.sessionId, body.questionId, body.lower, body.upper);
      const game = await readGame(body.sessionId, owner);
      return res.json({ success: true, judgement, savedAnswers: game.savedAnswers });
    }
    if (action === "finalize") {
      const user = await requireUser(req);
      if (!(await getUserById(user.userId))?.hasPersonality)
        throw new HttpError(
          409,
          "Choose your pattern and color to finish your scorecard.",
        );
      await attachGuestGame(user.userId, body.sessionId, await guestOwner(req));
      const result = await finishGame(user.userId, body.sessionId);
      const [dailyStats, performanceHistory, share] = await Promise.all([
        result.kind === 'onboarding' ? Promise.resolve(null) : getDailyStats(user.userId, result.edition),
        getPerformanceHistory(user.userId),
        prepareShare(user.userId, body.sessionId),
      ]);
      return res.json({ ...result, dailyStats, performanceHistory, share });
    }
    throw new HttpError(404, "Not found");
  } catch (error) {
    return fail(res, error);
  }
}
