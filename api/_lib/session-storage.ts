import { withGlossary } from "./glossary.js";
import { transaction, query } from "./db.js";
import type { PoolClient, QueryResultRow } from "pg";
import type { Question, Judgement } from "./types.js";
import { HttpError } from "./http.js";
import { Score } from "./scoring.js";
const isUuid = (s: unknown): s is string =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
// Owner values are created only by authenticated user lookup or guest-token validation.
const ownerColumn = (owner: string) =>
  owner.startsWith("guest:") ? "guest_session_hash" : "user_id";
const ownerKey = (owner: string) =>
  owner.startsWith("guest:") ? owner.slice(6) : owner;
export async function startGame(
  userId: string,
  edition: string,
  questions: Question[],
  practice = false,
  kind: 'daily' | 'onboarding' = 'daily',
  version: string | null = null,
) {
  return transaction(async (client) => {
    await client.query(
      userId.startsWith("guest:")
        ? "SELECT token_hash FROM guest_sessions WHERE token_hash=$1 FOR UPDATE"
        : "SELECT id FROM users WHERE id=$1 FOR UPDATE",
      [ownerKey(userId)],
    );
    if (!practice) {
      const { rows } = await client.query(
        `SELECT id FROM game_sessions WHERE ${ownerColumn(userId)}=$1 AND (edition=$2 OR $3='onboarding') AND kind=$3 AND is_ranked`,
        [ownerKey(userId), edition, kind],
      );
      if (rows[0]) return readGame(rows[0].id, userId, client);
    }
    const { rows } = await client.query(
      `INSERT INTO game_sessions(${ownerColumn(userId)},edition,is_ranked,kind,onboarding_version) VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [ownerKey(userId), edition, !practice, kind, version],
    );
    const id = rows[0].id;
    for (let i = 0; i < questions.length; i++)
      await client.query(
        "INSERT INTO game_questions(session_id,question_id,position,snapshot) VALUES($1,$2,$3,$4)",
        [id, questions[i].id, i, JSON.stringify(questions[i])],
      );
    return readGame(id, userId, client);
  });
}
function judgement(row: QueryResultRow): Judgement {
  const q: Question = row.snapshot;
  return {
    questionId: row.question_id,
    prompt: q.prompt,
    unit: q.unit,
    trueValue: q.trueValue,
    source: q.source,
    sourceUrl: q.sourceUrl,
    answerContext: q.answerContext,
    topic: q.topic,
    observationPeriod: q.observationPeriod,
    lower: Number(row.lower_bound),
    upper: Number(row.upper_bound),
    hit: row.captured,
    score: Number(row.score),
  };
}
export async function readGame(
  id: unknown,
  userId: string,
  client?: PoolClient,
  revealForFinalization = false,
) {
  if (!isUuid(id)) throw new HttpError(404, "Game not found.");
  const run = client ? client.query.bind(client) : query;
  const { rows } = await run(
    `SELECT id,edition::text,completed_at,is_ranked,kind,onboarding_version FROM game_sessions WHERE id=$1 AND ${ownerColumn(userId)}=$2`,
    [id, ownerKey(userId)],
  );
  if (!rows[0]) throw new HttpError(404, "Game not found.");
  const { rows: items } = await run(
    `SELECT q.question_id,q.snapshot,a.lower_bound,a.upper_bound,a.captured,a.score FROM game_questions q
    LEFT JOIN game_answers a ON (q.session_id,q.question_id)=(a.session_id,a.question_id)
    WHERE q.session_id=$1 ORDER BY q.position`,
    [id],
  );
  return {
    sessionId: id,
    edition: rows[0].edition,
    isRanked: rows[0].is_ranked,
    kind: rows[0].kind as "daily" | "onboarding",
    onboardingVersion: rows[0].onboarding_version,
    completed: !!rows[0].completed_at,
    questions: (await withGlossary(
      items.map((r) => ({
        id: r.question_id,
        prompt: r.snapshot.prompt,
        unit: r.snapshot.unit,
      })),
      client,
    )).map((q, i) => ({ ...q, max: items[i].snapshot.max, topic: items[i].snapshot.topic,
      observationPeriod: items[i].snapshot.observationPeriod,
      ...(rows[0].kind === 'onboarding' ? { glossary: items[i].snapshot.glossary ?? q.glossary } : {}),
    })),
    savedAnswers: items.filter((r) => r.lower_bound !== null).map((r) => ({
      questionId: r.question_id, lower: Number(r.lower_bound), upper: Number(r.upper_bound),
    })),
    judgements: rows[0].kind === 'onboarding' && !rows[0].completed_at && !revealForFinalization
      ? [] : items.filter((r) => r.lower_bound !== null).map(judgement),
  };
}
export async function saveAnswer(
  userId: string,
  sessionId: unknown,
  questionId: unknown,
  lower: unknown,
  upper: unknown,
) {
  if (
    !isUuid(sessionId) ||
    !isUuid(questionId) ||
    typeof lower !== "number" ||
    typeof upper !== "number" ||
    ![lower, upper].every((n) => Number.isFinite(n) && Math.abs(n) <= 1e100) ||
    lower > upper
  )
    throw new HttpError(400, "Enter finite, ordered bounds.");
  return transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT completed_at,kind FROM game_sessions WHERE id=$1 AND ${ownerColumn(userId)}=$2 FOR UPDATE`,
      [sessionId, ownerKey(userId)],
    );
    if (!rows[0]) throw new HttpError(404, "Game not found.");
    const { rows: items } = await client.query(
      `SELECT q.*,a.lower_bound,a.upper_bound,a.score,a.captured FROM game_questions q
      LEFT JOIN game_answers a ON (q.session_id,q.question_id)=(a.session_id,a.question_id)
      WHERE q.session_id=$1 ORDER BY q.position`,
      [sessionId],
    );
    const item = items.find((r) => r.question_id === questionId);
    if (!item) throw new HttpError(400, "Question is not part of this game.");
    if (item.lower_bound !== null) {
      if (
        Number(item.lower_bound) !== lower ||
        Number(item.upper_bound) !== upper
      )
        throw new HttpError(409, "This range is already locked.");
      return judgement(item);
    }
    if (rows[0].completed_at)
      throw new HttpError(409, "Game is already complete.");
    if (items.find((r) => r.lower_bound === null)?.question_id !== questionId)
      throw new HttpError(409, "Answer the current question first.");
    const q: Question = item.snapshot;
    if (rows[0].kind === "onboarding" && (lower < 0 || upper > (q.max ?? 1e100)))
      throw new HttpError(400, "Keep your bounds within the question units.");
    const score = Score.calculateScore(
        lower,
        upper,
        q.trueValue,
        q.scoringReference ?? 1,
      ),
      hit = Score.inBounds(lower, upper, q.trueValue);
    await client.query(
      "INSERT INTO game_answers(session_id,question_id,lower_bound,upper_bound,score,captured) VALUES($1,$2,$3,$4,$5,$6)",
      [sessionId, questionId, lower, upper, score, hit],
    );
    return judgement({
      ...item,
      lower_bound: lower,
      upper_bound: upper,
      score,
      captured: hit,
    });
  });
}
export async function finishGame(userId: string, id: unknown) {
  if (!isUuid(id)) throw new HttpError(404, "Game not found.");
  return transaction(async (client) => {
    const { rows } = await client.query(
      "SELECT id FROM game_sessions WHERE id=$1 AND user_id=$2 FOR UPDATE",
      [id, userId],
    );
    if (!rows[0]) throw new HttpError(404, "Game not found.");
    const game = await readGame(id, userId, client, true);
    if (game.judgements.length !== game.questions.length)
      throw new HttpError(409, "Answer every question before finishing.");
    await client.query(
      "UPDATE game_sessions SET completed_at=COALESCE(completed_at,now()) WHERE id=$1",
      [id],
    );
    return {
      judgements: game.judgements,
      score: Score.calculateTotalScore(game.judgements.map((j) => j.score)),
      totalQuestions: game.questions.length,
      edition: game.edition,
      isRanked: game.isRanked,
      kind: game.kind,
      onboardingVersion: game.onboardingVersion,
    };
  });
}
