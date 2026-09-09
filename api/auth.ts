import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query, transaction } from "./_lib/db.js";
import {
  getAuthUser,
  requireUser,
  createAuthSession,
  setSessionCookie,
  revokeSession,
  rateLimit,
  hashPassword,
  verifyPassword,
} from "./_lib/auth.js";
import {
  getUserById,
  isValidUsername,
  isUsernameAvailable,
  publicUser,
  updateUserProfile,
} from "./_lib/users.js";
import { validIcon } from "./_lib/player-profile.js";
import { HttpError, prepare, fail, requireMethod } from "./_lib/http.js";
const guest = {
  id: "",
  displayName: "",
  email: null,
  isAnonymous: true,
  avatarIcon: null,
  sessionCount: 0,
  totalScore: 0,
  averageScore: 0,
  gamesPlayed: 0,
  currentStreak: 0,
  bestStreak: 0,
  calibrationRate: 0,
  questionsCaptured: 0,
  bestSingleScore: 0,
};
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!prepare(req, res)) return;
    const action = req.url?.split("?")[0].split("/").pop();
    requireMethod(req, action === "me" ? "GET" : "POST");
    const body = req.body ?? {};
    const auth = await getAuthUser(req);
    if (action === "device" || action === "me") {
      const user = auth ? await getUserById(auth.userId) : null;
      return res.json({ user: user ? publicUser(user) : guest });
    }
    if (action === "logout") {
      await revokeSession(req);
      setSessionCookie(res, null);
      return res.json({ success: true });
    }
    if (action === "check-username") {
      await rateLimit(req, "check-username", 100);
      const valid = isValidUsername(body.username);
      return res.json({
        valid,
        available: valid && (await isUsernameAvailable(body.username)),
      });
    }
    if (action === "profile") {
      const identity = await requireUser(req);
      if (!validIcon(body.avatarIcon))
        throw new HttpError(400, "Choose one of the available patterns.");
      await updateUserProfile(identity.userId, { avatarIcon: body.avatarIcon,
        avatarColor: body.avatarColor, scorecardStyle: body.scorecardStyle });
      return res.json({
        user: publicUser((await getUserById(identity.userId))!),
      });
    }
    if (action === "claim-username") {
      if (auth)
        return res.json({
          user: publicUser((await getUserById(auth.userId))!),
        });
      if (!isValidUsername(body.username))
        throw new HttpError(400, "Use 3–20 letters, numbers, or underscores.");
      await rateLimit(req, "signup");
      const created = await transaction(async (client) => {
        const { rows } = await client.query(
          "INSERT INTO users(username) VALUES($1) RETURNING id",
          [body.username],
        );
        return {
          id: rows[0].id,
          token: await createAuthSession(client, rows[0].id),
        };
      });
      setSessionCookie(res, created.token);
      return res.json({ user: publicUser((await getUserById(created.id))!) });
    }
    if (!["signup", "claim-account", "login"].includes(action ?? ""))
      throw new HttpError(404, "Not found");
    await rateLimit(req, "credentials");
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = body.password;
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      typeof password !== "string" ||
      password.length > 256
    )
      throw new HttpError(400, "Enter a valid email and password.");
    if (action === "login") {
      const { rows } = await query(
        "SELECT u.id,c.password_hash FROM users u JOIN user_credentials c ON c.user_id=u.id WHERE lower(u.email)=$1",
        [email],
      );
      if (!(await verifyPassword(password, rows[0]?.password_hash)))
        throw new HttpError(401, "Invalid email or password.");
      const token = await transaction((client) =>
        createAuthSession(client, rows[0].id),
      );
      await revokeSession(req);
      setSessionCookie(res, token);
      return res.json({ user: publicUser((await getUserById(rows[0].id))!) });
    }
    if (password.length < 12)
      throw new HttpError(400, "Use a password with at least 12 characters.");
    if (action === "claim-account" && !auth)
      throw new HttpError(401, "Choose a username first.");
    if (!auth && !isValidUsername(body.displayName))
      throw new HttpError(400, "Use 3–20 letters, numbers, or underscores.");
    const passwordHash = await hashPassword(password);
    const created = await transaction(async (client) => {
      let id = auth?.userId;
      if (id) {
        const { rows } = await client.query(
          "SELECT email FROM users WHERE id=$1 FOR UPDATE",
          [id],
        );
        if (rows[0]?.email)
          throw new HttpError(409, "This profile already has an email.");
        await client.query("UPDATE users SET email=$2 WHERE id=$1", [
          id,
          email,
        ]);
      } else {
        const { rows } = await client.query(
          "INSERT INTO users(username,email) VALUES($1,$2) RETURNING id",
          [body.displayName, email],
        );
        id = rows[0].id;
      }
      await client.query(
        "INSERT INTO user_credentials(user_id,password_hash) VALUES($1,$2)",
        [id, passwordHash],
      );
      return { id: id!, token: await createAuthSession(client, id!) };
    });
    await revokeSession(req);
    setSessionCookie(res, created.token);
    return res.json({ user: publicUser((await getUserById(created.id))!) });
  } catch (error) {
    return fail(res, error);
  }
}
