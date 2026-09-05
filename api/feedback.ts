import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthUser } from "./_lib/auth.js";
import { prepare } from "./_lib/http.js";
import { createFeedback } from "./_lib/feedback.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!prepare(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { feedbackText, pageUrl } = req.body;

    // Validate feedback text
    if (!feedbackText || typeof feedbackText !== "string") {
      return res.status(400).json({ error: "Feedback text is required" });
    }

    const trimmedFeedback = feedbackText.trim();
    if (trimmedFeedback.length < 1) {
      return res.status(400).json({ error: "Feedback text cannot be empty" });
    }

    if (trimmedFeedback.length > 5000) {
      return res
        .status(400)
        .json({ error: "Feedback text must be 5000 characters or less" });
    }

    // Get user ID if authenticated (can be null for anonymous)
    const authUser = await getAuthUser(req);
    const userId = authUser?.userId || null;

    // Get user agent from headers
    const userAgent = req.headers["user-agent"] || null;

    const feedback = await createFeedback(
      userId,
      trimmedFeedback,
      userAgent || undefined,
      pageUrl || undefined,
    );

    return res.status(201).json({
      success: true,
      feedback: {
        id: feedback.id,
        createdAt: feedback.createdAt,
      },
    });
  } catch (err) {
    console.error("Submit feedback error:", err);
    return res.status(500).json({ error: "Failed to submit feedback" });
  }
}
