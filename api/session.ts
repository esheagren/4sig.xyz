import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "./_lib/auth.js";
import { getDailyQuestions, pacificDate } from "./_lib/questions.js";
import { startGame, saveAnswer, finishGame } from "./_lib/session-storage.js";
import {
  getDailyStats,
  getPerformanceHistory,
  getOverallLeaderboard,
} from "./_lib/sessions.js";
import { HttpError, prepare, fail, requireMethod } from "./_lib/http.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!prepare(req, res)) return;
    const action = req.url?.split("?")[0].split("/").pop();
    if (action === "leaderboard") {
      requireMethod(req, "GET");
      return res.json({ leaderboard: await getOverallLeaderboard() });
    }
    requireMethod(req, "POST");
    const user = await requireUser(req),
      body = req.body ?? {};
    if (action === "start") {
      const edition = pacificDate(),
        questions = await getDailyQuestions(edition);
      if (!questions.length)
        throw new HttpError(503, "Today’s numbers are not ready yet.");
      return res.json(
        await startGame(
          user.userId,
          edition,
          questions,
          body.practice === true,
        ),
      );
    }
    if (action === "answer")
      return res.json({
        success: true,
        judgement: await saveAnswer(
          user.userId,
          body.sessionId,
          body.questionId,
          body.lower,
          body.upper,
        ),
      });
    if (action === "finalize") {
      const result = await finishGame(user.userId, body.sessionId);
      const [dailyStats, performanceHistory] = await Promise.all([
        getDailyStats(user.userId, result.edition),
        getPerformanceHistory(user.userId),
      ]);
      return res.json({ ...result, dailyStats, performanceHistory });
    }
    throw new HttpError(404, "Not found");
  } catch (error) {
    return fail(res, error);
  }
}
