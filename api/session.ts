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
      const edition = pacificDate(),
        questions = await getDailyQuestions(edition);
      if (!questions.length)
        throw new HttpError(503, "Today’s numbers are not ready yet.");
      if (auth && !body.practice) {
        const guest = await guestOwner(req);
        const candidates = new Set([
          body.resumeId,
          await guestGameForEdition(guest, edition, auth.userId),
        ]);
        for (const id of candidates) {
          if (!id) continue;
          await attachGuestGame(auth.userId, id, guest);
          try {
            const resumed = await readGame(id, auth.userId);
            if (resumed.edition === edition) return res.json(resumed);
          } catch (error) {
            if (!(error instanceof HttpError && error.status === 404))
              throw error;
          }
        }
      }
      return res.json(
        await startGame(owner, edition, questions, body.practice === true),
      );
    }
    if (action === "answer")
      return res.json({
        success: true,
        judgement: await saveAnswer(
          owner,
          body.sessionId,
          body.questionId,
          body.lower,
          body.upper,
        ),
      });
    if (action === "finalize") {
      const user = await requireUser(req);
      if (!(await getUserById(user.userId))?.hasPersonality)
        throw new HttpError(
          409,
          "Choose your pattern and color before revealing your score.",
        );
      await attachGuestGame(user.userId, body.sessionId, await guestOwner(req));
      const result = await finishGame(user.userId, body.sessionId);
      const [dailyStats, performanceHistory, share] = await Promise.all([
        getDailyStats(user.userId, result.edition),
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
