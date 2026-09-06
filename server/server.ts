import "dotenv/config";
import express from "express";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import auth from "../api/auth.js";
import session from "../api/session.js";
import user from "../api/user.js";
import feedback from "../api/feedback.js";
import health from "../api/health.js";
import designspace from "../api/designspace.js";
const app = express();
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "4kb" }));
app.all(["/designspace", "/designspace/"], (req, res) => {
  void designspace(req as unknown as VercelRequest, res as unknown as VercelResponse);
});
for (const [path, handler] of Object.entries({
  auth,
  session,
  user,
  feedback,
  health,
  designspace,
})) {
  app.use("/api/" + path, (req, res) => {
    req.url = req.originalUrl;
    void Promise.resolve(
      handler(
        req as unknown as VercelRequest,
        res as unknown as VercelResponse,
      ),
    ).catch(() => res.status(500).json({ error: "Request failed." }));
  });
}
app.listen(Number(process.env.PORT) || 3001, () =>
  console.log("API ready on port " + (process.env.PORT || 3001)),
);
