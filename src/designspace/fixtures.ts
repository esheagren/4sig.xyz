import type { Question } from "../../api/_lib/types";
import { Score } from "../../shared/scoring";
import type { Screen } from "./catalog";

/** This adapter exists only in the private preview document, never in the game entry. */
export function installPreviewData(screen: Screen) {
  const memory = (): Storage => {
    const values = new Map<string, string>();
    return {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, String(value));
      },
      removeItem: (key) => {
        values.delete(key);
      },
      key: (index) => [...values.keys()][index] ?? null,
    };
  };
  // Keep drafts, device IDs, tutorial flags, and preferences out of the real player's storage.
  Object.defineProperty(window, "localStorage", {
    value: memory(),
    configurable: true,
  });
  Object.defineProperty(window, "sessionStorage", {
    value: memory(),
    configurable: true,
  });
  localStorage.setItem("four_sigma_ruler_feedback", "off");
  let member = !!screen.member;
  let hasPersonality = member;
  let name = "sample_player",
    color = "#276c66",
    icon = "wave",
    style = "wave";
  const kind = screen.kind ?? "onboarding";
  const supplied: Question[] = JSON.parse(
    document.getElementById("design-preview-data")?.textContent ?? "[]",
  );
  if (supplied.length !== 8)
    throw new Error("Preview data is unavailable. Reload the design space.");
  const questions =
    kind === "daily" ? [supplied[3], ...supplied.slice(0, 3)] : supplied;
  const sessionId = "design-preview-session";
  type Judgement = {
    questionId: string;
    prompt: string;
    unit?: string;
    trueValue: number;
    lower: number;
    upper: number;
    hit: boolean;
    score: number;
    source?: string;
    sourceUrl?: string;
    answerContext?: string;
    topic?: string;
    observationPeriod?: string;
  };
  const judge = (index: number, lower: number, upper: number): Judgement => {
    const q = questions[index];
    return {
      questionId: q.id,
      prompt: q.prompt,
      unit: q.unit,
      trueValue: q.trueValue,
      lower,
      upper,
      hit: Score.inBounds(lower, upper, q.trueValue),
      score: Score.calculateScore(lower, upper, q.trueValue),
      source: q.source,
      sourceUrl: q.sourceUrl,
      answerContext: q.answerContext,
      topic: q.topic,
      observationPeriod: q.observationPeriod,
    };
  };
  const answers: Judgement[] = Array.from(
    { length: screen.answered ?? 0 },
    (_, i) => {
      const q = questions[i];
      const reviewBounds =
        screen.id === "starting-score"
          ? [
              [25, 40],
              [34, 42],
              [25, 28],
              [80, 80],
              [5, 20],
              [60, 75],
              [400, 700],
              [26, 29],
            ][i]
          : screen.id === "daily-score"
            ? [
                [70, 90],
                [35, 40],
                [30, 30],
                [10, 60],
              ][i]
            : undefined;
      const bounds = reviewBounds
        ? { lower: reviewBounds[0], upper: reviewBounds[1] }
        : i === 0 && screen.preview.bounds
          ? screen.preview.bounds
          : {
              lower: q.trueValue * 0.85,
              upper: Math.min(q.max ?? Infinity, q.trueValue * 1.1),
            };
      return judge(i, bounds.lower, bounds.upper);
    },
  );
  const score = () => Score.calculateTotalScore(answers.map((a) => a.score));
  const user = () => ({
    id: member ? "design-player" : "",
    email: null,
    displayName: member ? name : "",
    isAnonymous: !member,
    hasPersonality: member && hasPersonality,
    avatarIcon: icon,
    avatarColor: color,
    scorecardStyle: style,
    totalScore: score() || 1824.6,
    averageScore: 456.1,
    gamesPlayed: 4,
    currentStreak: 3,
    bestStreak: 4,
    questionsAnswered: 24,
    calibrationRate: 0.875,
    questionsCaptured: 21,
    bestSingleScore: 310,
    sessionCount: 4,
    createdAt: "2026-09-01",
    onboarding: member
      ? {
          sessionId: "preview-baseline",
          score: 1234.5,
          hits: 7,
          count: 8,
          version: "first-eight-v1",
        }
      : null,
  });
  const game = () => ({
    sessionId,
    edition: "2026-09-12",
    kind,
    isRanked: true,
    completed: answers.length === questions.length && member,
    questions: questions.map(
      ({ id, prompt, unit, max, topic, observationPeriod, glossary }) => ({
        id,
        prompt,
        unit,
        max,
        topic,
        observationPeriod,
        glossary,
      }),
    ),
    savedAnswers: answers,
    judgements: answers,
  });
  const json = (value: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify(value), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
  let startAttempts = 0;
  // Fail closed: every fetch in a preview is handled here, including unrecognized routes.
  window.fetch = (input, init) => {
    const path = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      location.href,
    ).pathname;
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    if (path.endsWith("/auth/me")) return json({ user: user() });
    if (path.endsWith("/session/start")) {
      if (screen.id === "unavailable" && startAttempts++ === 0)
        return json(
          { error: "Could not load today’s questions. Please try again." },
          503,
        );
      return json(game());
    }
    if (path.endsWith("/session/answer")) {
      const index = questions.findIndex((q) => q.id === body.questionId);
      if (index !== answers.length)
        return json({ error: "Reset this preview to answer it again." }, 409);
      const judgement = judge(index, body.lower, body.upper);
      answers.push(judgement);
      return json({ judgement, savedAnswers: answers });
    }
    if (path.endsWith("/session/finalize"))
      return json({
        ...game(),
        score: score(),
        share: {
          id: "sample",
          player: { username: name, icon, color, style },
          score: score(),
          hits: answers.map((a) => a.hit),
          kind,
          isRanked: true,
          edition: "2026-09-12",
        },
        dailyStats:
          kind === "daily"
            ? {
                dailyRank: 12,
                todaysAverage: score() > 0 ? score() / 1.28 : 240,
                playersBelowToday: score() > 0 ? 116 : 0,
                totalParticipantsToday: 128,
                todayLeaderboard: [
                  { rank: 12, username: name, score: score() },
                ],
              }
            : null,
      });
    if (path.endsWith("/check-username"))
      return json({
        available: body.username?.toLowerCase() !== "taken",
        suggestions: ["sample_player", "curious_mind"],
      });
    if (path.endsWith("/claim-username")) {
      member = true;
      name = body.username;
      hasPersonality = false;
      return json({ user: user() });
    }
    if (path.endsWith("/profile")) {
      hasPersonality = true;
      name = body.displayName ?? name;
      icon = body.avatarIcon ?? icon;
      color = body.avatarColor ?? color;
      style = body.scorecardStyle ?? style;
      return json({ user: user() });
    }
    if (
      path.endsWith("/login") ||
      path.endsWith("/signup") ||
      path.endsWith("/claim-account")
    ) {
      member = true;
      hasPersonality = true;
      return json({ user: user() });
    }
    if (path.endsWith("/logout")) {
      member = false;
      return json({ user: user() });
    }
    if (path.endsWith("/performance-history"))
      return json({
        history: [
          { date: "2026-09-10", userScore: 423, avgScore: 245 },
          { date: "2026-09-11", userScore: 491, avgScore: 271 },
        ],
      });
    if (path.endsWith("/feedback")) return json({ success: true });
    return json(
      { error: "This action is not part of the design preview." },
      400,
    );
  };
}
