import { playerScorecard } from '../../../shared/ink-collection';
import { normalizeStyle } from '../../../shared/player-profile';
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  KeyboardEvent,
} from "react";
import { flushSync } from "react-dom";
import { useAuth } from "../../context/AuthContext";
import { useAnalytics } from "../../context/PostHogContext";
import { getDeviceId } from "../../lib/device";
import { BottomNav } from '../nav/BottomNav';
import { useRulerSound } from './useRulerSound';
import { AuthModal } from "../nav/AuthModal";
import type { Question, Result } from "./game";
import "./style.css";
import "./onboarding.css";
import { Score } from "../../../shared/scoring";
import { ScoringExamples } from "./ScoringExamples";
import { CalibrationSetup } from "./CalibrationSetup";
import { PracticeTip } from "./PracticeTip";
import { WelcomeProbability } from "./WelcomeProbability";
import { WorldviewGrid } from "./WorldviewGrid";
import { ScoreStory } from './ScoreStory';
import type { DailyStats } from '../../../api/_lib/types';
import type { AnswerInsight } from '../../../shared/answer-insight';
import type { ScorecardData } from '../../../shared/scorecard';
import { PlayerIdentity } from "./PlayerIdentity";
import {
  validPlayerIcon,
  normalizeColor,
  normalizeIcon,
} from "./player";
import type { Player } from "./player";
import { QuestionText } from "./QuestionText";
import type { GlossaryAnnotation } from "../../lib/glossary";
import { NumberPad } from "./NumberPad";
import { formatEntry } from "./number-entry";
import { SourceLinks } from "./SourceLinks";
import {
  compact,
  fitDomain,
  initialBounds,
  parseAmount,
  points,
  quantity,
  scoreText,
  totalPoints,
  validBounds,
} from "./game";
import type { Bounds } from "./game";
import { HoldToConfirm } from "./HoldToConfirm";
import { rulerScale } from "./ruler-scale";
import { moveBound, startDrag, stepDrag } from "./range-drag";
import { RulerFeedback, RulerTickGate } from "./ruler-feedback";

// The current question bank is curated for nonnegative quantities.
const RANGE_MIN = 0;
const DEMO_QUESTION: Question = {
  id: 'practice',
  title: 'How tall is One World Trade Center, including its spire, in feet?',
  short: 'One World Trade Center height', unit: 'feet', answer: 1776,
  category: 'Practice', date: '', scale: 1,
  source: 'World Trade Center',
  url: 'https://wtc.com/work-place/1wtc/',
  context: 'One World Trade Center stands 1,776 feet tall, including its spire—a deliberate reference to the year of American independence.',
};
function tutorialSeen(id: string, mark = false) {
  try {
    if (mark) localStorage.setItem('four_sigma_tutorial_' + id, 'done');
    return localStorage.getItem('four_sigma_tutorial_' + id) === 'done';
  } catch { return false; }
}

function activeGame(id?: string | null) {
  try {
    if (id === undefined) return localStorage.getItem("four_sigma_active_game");
    if (id === null) localStorage.removeItem("four_sigma_active_game");
    else localStorage.setItem("four_sigma_active_game", id);
  } catch {
    /* Play also works when browser storage is disabled. */
  }
  return null;
}
type Stage =
  | "welcome"
  | "scoring"
  | "worldview"
  | "setup"
  | "identity"
  | "loading"
  | "estimate"
  | "range"
  | "saving"
  | "sweeping"
  | "revealed"
  | "finalizing"
  | "complete";

type ServerJudgement = {
  answerInsight?: AnswerInsight;
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
function toResult(j: ServerJudgement): Result {
  return {
    lower: j.lower,
    upper: j.upper,
    estimate: (j.lower + j.upper) / 2,
    hit: j.hit,
    score: j.score,
    assisted: false,
    question: {
      id: j.questionId,
      title: j.prompt,
      short: j.prompt,
      unit: j.unit ?? "",
      answer: j.trueValue,
      source: j.source ?? "",
      url: j.sourceUrl ?? "",
      context: j.answerContext ?? "",
      insight: j.answerInsight,
      category: j.topic ?? "Daily",
      date: j.observationPeriod ?? "",
      scale: 1,
    },
  };
}
type Standings = DailyStats;
export type GamePreview = {
  stage?: Stage; demo?: boolean; tip?: 'estimate' | 'range'; calculator?: boolean;
  bounds?: Bounds; menu?: 'stats' | 'profile' | 'settings' | 'play'; auth?: boolean;
};
export default function IntervalGame({ preview }: { preview?: GamePreview } = {}) {
  const {
    user,
    authToken,
    isLoading: authLoading,
    claimUsername,
    refreshUser,
  } = useAuth();
  const { capture } = useAnalytics();
  const [orderedQuestions, setQuestions] = useState<Question[]>([]),
    [sessionId, setSessionId] = useState(""),
    [edition, setEdition] = useState("");
  const [isRanked, setRanked] = useState(true);
  const [onboarding, setOnboarding] = useState(false),
    [demo, setDemo] = useState(false),
    [dailyAvailable, setDailyAvailable] = useState(false);
  const [practiceTip, setPracticeTip] = useState<'estimate' | 'range' | null>(null);
  const finalizing = useRef(false);
  const [standings, setStandings] = useState<Standings | null>(null),
    [authOpen, setAuthOpen] = useState(preview?.auth ?? false);
  const starting = useRef(false);
  const previewApplied = useRef(false);
  function headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-Device-Id": getDeviceId(),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    };
  }
  async function request(path: string, body?: unknown) {
    const response = await fetch(`/api/${path}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body ?? {}),
    });
    const data = await response.json().catch(() => {
      throw new Error("Could not connect. Please try again.");
    });
    if (!response.ok)
      throw new Error(data.error || "Could not save. Please try again.");
    return data;
  }
  const [index, setIndex] = useState(0),
    [stage, setStage] = useState<Stage>("loading");
  const [text, setText] = useState(""),
    [bounds, setBounds] = useState<Bounds>({ lower: 0, estimate: 0, upper: 1 });
  const [domain, setDomain] = useState<[number, number]>([0, 1]),
    [results, setResults] = useState<Result[]>([]);
  const [dragCue, setDragCue] = useState("");
  const [soundOn] = useRulerSound();
  const [feedback] = useState(() => new RulerFeedback());
  const keyboardTicks = useRef(new RulerTickGate());
  useEffect(() => {
    const stop = () => {
      if (document.hidden) feedback.stop();
    };
    document.addEventListener("visibilitychange", stop);
    window.addEventListener("blur", feedbackStop);
    function feedbackStop() {
      feedback.stop();
    }
    return () => {
      document.removeEventListener("visibilitychange", stop);
      window.removeEventListener("blur", feedbackStop);
      feedback.dispose();
    };
  }, [feedback]);
  useEffect(() => {
    feedback.enabled = soundOn;
    if (!soundOn) feedback.stop();
  }, [feedback, soundOn]);
  const [assisted, setAssisted] = useState(false),
    [error, setError] = useState(""),
    [help, setHelp] = useState(false);
  const [editing, setEditing] = useState<"lower" | "upper" | "estimate" | null>(null),
    [editText, setEditText] = useState("");
  const [player, setPlayer] = useState<Player | null>(null);
  const initialPlayer: Partial<Player> = {
    ...(!user?.isAnonymous && user ? { username: user.displayName } : {}),
    ...(user?.hasPersonality ? { icon: normalizeIcon(user.avatarIcon), style: normalizeStyle(user.scorecardStyle, user.avatarIcon), color: normalizeColor(user.avatarColor) } : {}),
  };
  const cardData = useMemo<ScorecardData | null>(() => player ? playerScorecard({
    player, score: totalPoints(results), hits: results.map(result => result.hit),
    label: onboarding ? 'STARTING CALIBRATION' : edition,
    practice: !isRanked,
  }) : null, [player, results, onboarding, edition, isRanked]);
  const ruler = useRef<HTMLDivElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const editDialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false),
    dragCleanup = useRef<(() => void) | null>(null);
  const question = demo ? DEMO_QUESTION : results[index]?.question ?? orderedQuestions[index],
    editable = stage === "range",
    showAnswer = stage === "sweeping" || stage === "revealed";
  const questionWordCount = question?.title.match(/\S+/g)?.length ?? 0;
  const result: Result = demo ? {
    ...bounds, question: DEMO_QUESTION, assisted: false,
    hit: Score.inBounds(bounds.lower, bounds.upper, DEMO_QUESTION.answer),
    score: Score.calculateScore(bounds.lower, bounds.upper, DEMO_QUESTION.answer),
  } : results[index];
  const
    visibleResults = stage === "sweeping" ? results.slice(0, -1) : results;
  const focusHeading = () =>
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
      heading.current?.focus({ preventScroll: true });
    });
  const scale = rulerScale(domain);
  const position = (n: number) =>
    ((n - domain[0]) / (domain[1] - domain[0])) * 100;
  const clipped = (n: number) => Math.max(0, Math.min(100, position(n)));
  const updateBounds = (b: Bounds, fit = true) => {
    setBounds(b);
    if (fit) setDomain(fitDomain(b, question.max, RANGE_MIN));
    setError("");
  };
  useEffect(() => {
    if (stage !== "sweeping") return;
    const id = setTimeout(
      () => setStage("revealed"),
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700,
    );
    return () => clearTimeout(id);
  }, [stage]);
  useEffect(() => {
    if (editing) editDialog.current?.showModal();
    else editDialog.current?.close();
  }, [editing]);
  useEffect(() => () => dragCleanup.current?.(), []);
  function beginRange() {
    const value = parseAmount(text);
    if (
      !Number.isFinite(value) ||
      value < RANGE_MIN ||
      value > (question.max ?? 1e100)
    ) {
      setError(
        question.max
          ? `Enter a number from 0 to ${question.max}.`
          : "Enter a number at or above 0, such as 4E5.",
      );
      return;
    }
    updateBounds(initialBounds(value, question.max, RANGE_MIN));
    setStage("range");
    if (demo) setPracticeTip('range');
    focusHeading();
  }
  function saveBound() {
    if (!editing) return;
    const value = parseAmount(editText);
    if (editing === "estimate") {
      if (!Number.isFinite(value) || value < RANGE_MIN || value > (question.max ?? 1e100)) {
        setError("Enter an estimate within the question’s units.");
        return;
      }
      updateBounds(initialBounds(value, question.max, RANGE_MIN));
      setText(String(value));
      setEditing(null);
      return;
    }
    const b = { ...bounds, [editing]: value };
    if (!validBounds(b, question.max, RANGE_MIN)) {
      setError(
        `Keep the lower bound at or below your estimate and the upper bound at or above it${question.max ? `, between 0 and ${question.max}` : ", and at or above 0"}.`,
      );
      return;
    }
    updateBounds(b);
    setEditing(null);
  }
  function drag(
    e: ReactPointerEvent<HTMLButtonElement>,
    part: "lower" | "upper",
  ) {
    if (!editable || !ruler.current || !e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    dragCleanup.current?.();
    feedback.enabled = soundOn;
    feedback.unlock();
    const ticks = new RulerTickGate();
    ticks.begin(bounds[part], domain);
    const touch = e.pointerType === "touch" || e.pointerType === "pen";
    const target = e.currentTarget,
      rect = ruler.current.getBoundingClientRect();
    let current = startDrag(bounds, domain, part),
      x = e.clientX,
      last = performance.now(),
      frame = 0,
      moved = false;
    const initialX = x;
    // Keep the handle anchored where it was grabbed within its touch target.
    const offset =
      x -
      (rect.left +
        ((bounds[part] - domain[0]) / (domain[1] - domain[0])) * rect.width);
    target.setPointerCapture(e.pointerId);
    const paint = (seconds: number) => {
      const next = stepDrag(
        current,
        (x - offset - rect.left) / rect.width,
        seconds,
        moved,
        RANGE_MIN,
        question.max,
      );
      if (next.bounds[part] !== current.bounds[part]) setBounds(next.bounds);
      const tick = ticks.sample(
        next.bounds[part],
        next.domain,
        performance.now(),
      );
      if (tick) feedback.play(tick, touch);
      if (
        next.domain[0] !== current.domain[0] ||
        next.domain[1] !== current.domain[1]
      )
        setDomain(next.domain);
      if (next.cue !== current.cue) setDragCue(next.cue);
      current = next;
    };
    const move = (event: PointerEvent) => {
      x = event.clientX;
      moved ||= Math.abs(x - initialX) >= 6;
      paint(0);
    };
    const tick = (now: number) => {
      if (document.hidden) {
        end();
        return;
      }
      paint(Math.min((now - last) / 1000, 0.05));
      last = now;
      frame = requestAnimationFrame(tick);
    };
    const end = () => {
      cancelAnimationFrame(frame);
      feedback.stop();
      setDragCue("");
      window.removeEventListener("blur", end);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
      target.removeEventListener("lostpointercapture", end);
      if (target.hasPointerCapture(e.pointerId))
        target.releasePointerCapture(e.pointerId);
      dragCleanup.current = null;
    };
    window.addEventListener("blur", end);
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
    target.addEventListener("lostpointercapture", end);
    dragCleanup.current = end;
    frame = requestAnimationFrame(tick);
  }
  function keyMove(e: KeyboardEvent, part: "lower" | "upper") {
    if (
      !editable ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
    )
      return;
    e.preventDefault();
    const delta =
      ((["ArrowRight", "ArrowUp"].includes(e.key) ? 1 : -1) *
        (domain[1] - domain[0])) /
      50;
    const b = moveBound(bounds, part,
      Math.max(domain[0], Math.min(domain[1], bounds[part] + delta)), RANGE_MIN, question.max);
    if (validBounds(b, question.max, RANGE_MIN)) {
      feedback.enabled = soundOn;
      feedback.unlock();
      keyboardTicks.current.begin(bounds[part], domain);
      const tick = keyboardTicks.current.sample(
        b[part],
        domain,
        performance.now(),
      );
      if (tick) feedback.play(tick, false);
      updateBounds(b, false);
    }
  }
  async function submit() {
    if (lock.current || !editable) return;
    dragCleanup.current?.();
    lock.current = true;
    setError("");
    if (demo) { setStage("sweeping"); return; }
    setStage("saving");
    try {
      const data = await request("session/answer", {
        sessionId,
        questionId: question.id,
        lower: bounds.lower,
        upper: bounds.upper,
      });
      if (!data.judgement)
        throw new Error("Your answer could not be confirmed. Try again.");
      setResults((r) => [...r, toResult(data.judgement)]);
      setStage("sweeping");
      if (onboarding) capture('onboarding_answer_saved', { sessionId, questionId: question.id, position: index + 1 });
      capture("answer_submitted", {
        sessionId,
        questionId: question.id,
        lowerBound: bounds.lower,
        upperBound: bounds.upper,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your range.");
      setStage("range");
      lock.current = false;
    }
  }
  function resetRound() {
    setStage("estimate");
    setText("");
    setAssisted(false);
    setError("");
    lock.current = false;
    focusHeading();
  }
  function finish() {
    if (!user || user.isAnonymous || !user.hasPersonality) {
      setStage("identity");
      focusHeading();
      return;
    }
    void finalizeScore();
  }
  async function finalizeScore() {
    if (finalizing.current) return;
    finalizing.current = true;
    setStage("finalizing");
    setError("");
    try {
      const data = await request("session/finalize", { sessionId });
      setResults(data.judgements.map(toResult));
      setRanked(data.isRanked);
      setOnboarding(data.kind === "onboarding");
      setPlayer(data.share.player);
      setStandings(data.dailyStats ?? null);
      setStage("complete");
      activeGame(null);
      focusHeading();
      capture("game_session_completed", {
        sessionId,
        totalScore: data.score,
        hits: data.judgements.filter((j: ServerJudgement) => j.hit).length,
      });
      void refreshUser();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not finish. Please try again.",
      );
    } finally { finalizing.current = false; }
  }
  function next() {
    if (index === orderedQuestions.length - 1) {
      void finish();
    } else {
      setIndex((i) => i + 1);
      resetRound();
    }
  }
  async function startSession(practice = false, playDaily = false) {
    if (starting.current) return;
    starting.current = true;
    setStage("loading");
    setError("");
    try {
      const data = await request("session/start", {
        practice, playDaily,
        onboarding: !playDaily && new URLSearchParams(window.location.search).has('onboarding'),
        resumeId: practice || playDaily ? undefined : activeGame(),
      });
      if (!data.questions?.length)
        throw new Error("Today’s numbers are not ready yet.");
      const isOnboarding = data.kind === 'onboarding';
      setOnboarding(isOnboarding);
      setDemo(false);
      setDailyAvailable(data.dailyAvailable === true);
      setQuestions(
        data.questions.map(
          (q: {
            id: string;
            prompt: string;
            unit?: string;
            glossary?: GlossaryAnnotation[];
            max?: number;
            topic?: string;
            observationPeriod?: string;
          }) => ({
            id: q.id,
            title: q.prompt,
            glossary: q.glossary,
            max: q.max,
            short: q.prompt,
            unit: q.unit ?? "",
            answer: NaN,
            category: q.topic ?? "Daily",
            date: q.observationPeriod ?? "",
            scale: 1,
            source: "",
            url: "",
            context: "",
          }),
        ),
      );
      setSessionId(data.sessionId);
      activeGame(data.sessionId);
      setEdition(data.edition);
      setRanked(data.isRanked);
      setStandings(null);
      const saved: Result[] = (data.judgements ?? []).map(toResult);
      setResults(saved);
      const answered = data.savedAnswers?.length ?? saved.length;
      setIndex(Math.min(answered, data.questions.length - 1));
      if (data.completed || answered === data.questions.length) {
        if (!user || user.isAnonymous || !user.hasPersonality) {
          setStage("identity");
          return;
        }
        const completed = await request("session/finalize", {
          sessionId: data.sessionId,
        });
        setResults(completed.judgements.map(toResult));
        setRanked(completed.isRanked);
        setPlayer(completed.share.player);
        setStandings(completed.dailyStats ?? null);
        setStage("complete");
        activeGame(null);
        void refreshUser();
      } else if (isOnboarding && answered === 0 && !tutorialSeen(data.sessionId)) {
        setStage('welcome'); focusHeading();
      } else resetRound();
      if (preview && !previewApplied.current) {
        previewApplied.current = true;
        if (preview.stage) setStage(preview.stage);
        setDemo(preview.demo ?? false);
        setPracticeTip(preview.tip ?? null);
        if (preview.stage === 'revealed') setIndex(Math.max(0, saved.length - 1));
        if (preview.bounds) {
          setBounds(preview.bounds); setText(String(preview.bounds.estimate));
          setDomain(fitDomain(preview.bounds, undefined, RANGE_MIN));
        }
      }
      capture("game_session_started", {
        sessionId: data.sessionId,
        questionCount: data.questions.length,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not start. Please try again.",
      );
    } finally {
      starting.current = false;
    }
  }
  const automaticStart = useRef(false),
    automaticFinish = useRef("");
  const lifecycleActions = useRef({ startSession, finalizeScore });
  useEffect(() => {
    lifecycleActions.current = { startSession, finalizeScore };
  });
  useEffect(() => {
    if (!authLoading && !automaticStart.current) {
      automaticStart.current = true;
      if (user && !user.isAnonymous)
        setPlayer({
          username: user.displayName,
          icon: normalizeIcon(user.avatarIcon),
          style: normalizeStyle(user.scorecardStyle, user.avatarIcon), color: normalizeColor(user.avatarColor),
        });
      void lifecycleActions.current.startSession();
    }
    // Signing in at the final step attaches this browser's completed guest game.
    if (
      stage === "identity" &&
      user &&
      !user.isAnonymous &&
      user.hasPersonality &&
      sessionId &&
      automaticFinish.current !== sessionId + user.id
    ) {
      automaticFinish.current = sessionId + user.id;
      void lifecycleActions.current.finalizeScore();
    }
  }, [authLoading, user, stage, sessionId]);
  function restart() {
    void startSession(true);
  }
  async function startPlayer(chosen: Player) {
    if (!user)
      throw new Error("Could not connect to your account. Please reload.");
    if (user.isAnonymous) {
      const result = await claimUsername(chosen.username);
      if (!result.success)
        throw new Error(result.error || "Username unavailable.");
    }
    const data = await request("auth/profile", {
      avatarIcon: chosen.icon,
      avatarColor: chosen.color,
      scorecardStyle: chosen.style,
    });
    if (!validPlayerIcon(data.user?.avatarIcon))
      throw new Error("Your personality could not be saved.");
    setPlayer({
      username: data.user.displayName,
      icon: data.user.avatarIcon,
      color: normalizeColor(data.user.avatarColor),
      style: normalizeStyle(data.user.scorecardStyle, data.user.avatarIcon),
    });
    void refreshUser();
    await finalizeScore();
  }
  const stateRef = useRef({
    index,
    stage,
    bounds,
    assisted,
    orderedQuestions,
    edition,
  });
  stateRef.current = {
    index,
    stage,
    bounds,
    assisted,
    orderedQuestions,
    edition,
  };
  useEffect(() => {
    type Tool = {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean };
      execute: (input: unknown) => unknown;
    };
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            t: Tool,
            o: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController(),
      register = (t: Tool) => {
        try {
          void Promise.resolve(
            context.registerTool(t, { signal: lifecycle.signal }),
          ).catch(() => {});
        } catch {
          /* Optional API. */
        }
      };
    register({
      name: "read_interval_game",
      description:
        "Read the current question and player state without an unrevealed answer or hint.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => {
        const s = stateRef.current,
          q = s.orderedQuestions[s.index];
        return {
          question: q?.title,
          unit: q?.unit,
          date: s.edition,
          stage: s.stage,
          interval: s.stage === "estimate" ? null : s.bounds,
          assisted: s.assisted,
        };
      },
    });
    register({
      name: "set_interval",
      description: "Stage bounds in base units without submitting the answer.",
      inputSchema: {
        type: "object",
        properties: { lower: { type: "number" }, upper: { type: "number" } },
        required: ["lower", "upper"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input) => {
        const s = stateRef.current,
          q = s.orderedQuestions[s.index],
          v = input as { lower: number; upper: number };
        if (
          !v ||
          typeof v !== "object" ||
          Object.keys(v).sort().join() !== "lower,upper"
        )
          throw new Error("Expected lower and upper.");
        const b = { ...v, estimate: s.stage === "range" ? s.bounds.estimate : (v.lower + v.upper) / 2 };
        if (
          !q ||
          !["estimate", "range"].includes(s.stage) ||
          !validBounds(b, q.max, RANGE_MIN) ||
          b.upper > 1e100
        )
          throw new Error("Invalid bounds or locked.");
        flushSync(() => {
          setBounds(b);
          setDomain(fitDomain(b, q.max, RANGE_MIN));
          setStage("range");
          setError("");
        });
        return { staged: b, unit: q.unit };
      },
    });
    return () => lifecycle.abort();
  }, []);
  return (
    <div className={`interval-page${stage === 'welcome' ? ' welcome-page' : ''}`}>
      {stage === 'welcome' && <WelcomeProbability />}
      <div
        className={`interval-app ${["estimate", "range", "saving", "sweeping", "revealed", "complete"].includes(stage) ? "has-bottom-nav" : ""}`}
        style={
          {
            "--player-color":
              player?.color ?? normalizeColor(user?.avatarColor),
          } as CSSProperties
        }
      >
        <main>
          {stage === 'welcome' ? (
            <section className="onboarding-welcome">
              <h1 className="welcome-heading" ref={heading} tabIndex={-1}>
                <span>Welcome to</span>
                <span className="brand" aria-label="Four Sigma">4<span>σ</span></span>
              </h1>
              <p>Make sense of the numbers shaping our world—and find out how sure you should be.</p>
              <div className="welcome-play">
                <button className="hold-commit welcome-play-button" type="button" aria-label="Let’s play" onClick={() => { setDemo(true); setPracticeTip('estimate'); resetRound(); }}>
                  <svg className="commit-ring" viewBox="0 0 80 80" aria-hidden="true"><circle className="commit-track" cx="40" cy="40" r="36" /></svg>
                  <svg className="commit-arrow" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M7 16h18m-7-7 7 7-7 7" /></svg>
                </button>
                <span aria-hidden="true">Let’s play</span>
              </div>
            </section>
          ) : stage === "scoring" ? (
            <section className="scoring-lesson">
              <h1 ref={heading} tabIndex={-1}>How answers are scored</h1>
              <p className="scoring-intro">You earn more points for a smaller range that includes the right answer, and zero points if it misses.</p>
              <ScoringExamples />
              <button className="primary" onClick={() => { setStage("worldview"); focusHeading(); }}>
                Next <span aria-hidden="true">→</span>
              </button>
            </section>
          ) : stage === "worldview" ? (
            <section className="worldview-page">
              <h1 ref={heading} tabIndex={-1}>The numbers we focus on.</h1>
              <p className="worldview-intro">We focus on mesofacts: important numbers that shape our world and change over years.</p>
              <WorldviewGrid />
              <button className="primary" onClick={() => { setStage("setup"); focusHeading(); }}>
                Next <span aria-hidden="true">→</span>
              </button>
            </section>
          ) : stage === "setup" ? (
            <section className="calibration-setup">
              <h1 ref={heading} tabIndex={-1}>Four questions. Every day.</h1>
              <CalibrationSetup count={orderedQuestions.length} />
              <button className="primary" onClick={() => {
                tutorialSeen(sessionId, true); setDemo(false); setIndex(0); resetRound();
              }}>Begin <span aria-hidden="true">→</span></button>
            </section>
          ) : stage === "identity" ? (
            authLoading ? (
              <section className="identity-screen account-loading">
                <p role="status">Connecting…</p>
              </section>
            ) : user ? (
              <>
                <PlayerIdentity
                  key={user.id}
                  initial={initialPlayer}
                  onboarding={onboarding}
                  score={{ score: totalPoints(results), hits: results.map(result => result.hit), label: onboarding ? 'STARTING CALIBRATION' : edition, practice: !isRanked }}
                  onStart={startPlayer}
                />
                {user.isAnonymous && (
                  <button
                    className="text-button identity-signin"
                    onClick={() => setAuthOpen(true)}
                  >
                    Sign in to an existing account
                  </button>
                )}
              </>
            ) : (
              <section className="identity-screen account-loading">
                <p>Could not connect to your account.</p>
                <button className="primary" onClick={() => void refreshUser()}>
                  Try again
                </button>
              </section>
            )
          ) : stage === "loading" || stage === "finalizing" ? (
            <section className="identity-screen account-loading">
              <p role="status">
                {error ||
                  (stage === "loading"
                    ? "Loading your numbers…"
                    : "Saving your score…")}
              </p>
              {error && (
                <button
                  className="primary"
                  onClick={() =>
                    void (stage === "loading" ? startSession() : finish())
                  }
                >
                  Try again
                </button>
              )}
            </section>
          ) : stage !== "complete" ? (
            <>
              <section className="question-block" key={question.id}>
                <h1 ref={heading} tabIndex={-1}
                  data-length={questionWordCount > 28 ? 'long' : questionWordCount > 18 ? 'medium' : 'short'}
                  data-mobile-length={questionWordCount > 15 ? 'long' : questionWordCount > 10 ? 'medium' : 'short'}>
                  <QuestionText
                    text={question.title}
                    glossary={demo ? undefined : orderedQuestions[index]?.glossary}
                  />
                </h1>
                {(question.unit || question.date) && <div className="question-meta">
                  {question.unit && <span className="question-unit" aria-label={`Answer in ${question.unit}`}>{question.unit}</span>}
                  {question.date && <p className="date">{question.date}</p>}
                </div>}
              </section>
              {stage === "estimate" ? (
                <section className="estimate-panel">
                  <NumberPad
                    initialCalculator={preview?.calculator}
                    value={text}
                    onChange={(v) => {
                      setText(v);
                      setError("");
                    }}
                    onSubmit={beginRange}
                    label="Your estimate"
                    unit={question.unit}
                    showUnit={false}
                    error={error}
                    submitLabel="Set range"
                  />
                  {question.hint && (
                    <div className="hint-line">
                      {assisted ? (
                        <p role="status">
                          <span>Hint used</span> · {question.hint}
                        </p>
                      ) : (
                        <button
                          className="text-button"
                          onClick={() => setAssisted(true)}
                          aria-label="Use a scale hint; marks this round assisted"
                        >
                          Need a hint?
                        </button>
                      )}
                    </div>
                  )}
                </section>
              ) : (
                <>
                  <section
                    className={`instrument ${editable ? "editable" : ""} ${showAnswer ? "locked" : ""} ${bounds.lower === bounds.upper ? "exact-range" : ""}`}
                    aria-label="Your range"
                  >
                    <div className="readings">
                      {(["lower", "upper"] as const).map((part) => (
                        <button
                          key={part}
                          className="reading"
                          disabled={!editable}
                          onClick={() => {
                            setEditText(String(bounds[part]));
                            setError("");
                            setEditing(part);
                          }}
                          aria-label={`Edit ${part} bound, ${quantity(bounds[part], question.unit)}`}
                        >
                          <strong>{bounds.lower === bounds.upper ? formatEntry(String(bounds[part])) : compact(bounds[part])}</strong>
                        </button>
                      ))}
                    </div>
                    <div className="ruler-wrap">
                      <div className="ruler" ref={ruler}>
                        <div className="grid-lines">
                          {scale.ticks.map((tick) => (
                            <i
                              key={tick.value}
                              className={tick.major ? "major" : ""}
                              style={{ left: `${tick.position * 100}%` }}
                            />
                          ))}
                        </div>
                        <div className="axis" />
                        <div
                          className="belief-band"
                          style={{
                            left: `${clipped(bounds.lower)}%`,
                            width: `${clipped(bounds.upper) - clipped(bounds.lower)}%`,
                          }}
                        />
                        <div
                          className="anchor-mark"
                          style={{ left: `${clipped(bounds.estimate)}%` }}
                        >
                          ●
                        </div>
                        {(["lower", "upper"] as const).map((part) => (
                          <button
                            key={part}
                            className={`handle ${part} ${bounds[part] === bounds.estimate ? "at-anchor" : ""}`}
                            style={{ left: `${clipped(bounds[part])}%` }}
                            role="slider"
                            aria-label={`Drag ${part} bound`}
                            aria-valuemin={
                              part === "lower"
                                ? Math.min(domain[0], bounds.lower)
                                : bounds.estimate
                            }
                            aria-valuemax={
                              part === "upper"
                                ? (question.max ??
                                  Math.max(domain[1], bounds.upper))
                                : bounds.estimate
                            }
                            aria-valuenow={bounds[part]}
                            aria-valuetext={`${quantity(bounds[part], question.unit)}${bounds[part] === bounds.estimate ? ", at your estimate" : ""}`}
                            disabled={!editable}
                            onPointerDown={(e) => drag(e, part)}
                            onKeyDown={(e) => keyMove(e, part)}
                          >
                            <span>{part === "lower" ? "L" : "U"}</span>
                          </button>
                        ))}
                        {showAnswer && (
                          <div
                            className={`truth ${stage} ${clipped(question.answer) < 35 ? 'truth-near-left' : clipped(question.answer) > 65 ? 'truth-near-right' : ''}`}
                            role="img"
                            aria-label={`Actual value: ${formatEntry(String(question.answer))} ${question.unit}${position(question.answer) < 0 ? ', below the displayed scale' : position(question.answer) > 100 ? ', above the displayed scale' : ''}`}
                            style={
                              {
                                "--truth-x": `${clipped(question.answer)}%`,
                              } as CSSProperties
                            }
                          >
                            <span className="truth-value" aria-hidden="true">
                              {position(question.answer) < 0 ? '← ' : ''}
                              {formatEntry(String(question.answer))}
                              {position(question.answer) > 100 ? ' →' : ''}
                            </span>
                            <i className="truth-dot" aria-hidden="true" />
                          </div>
                        )}
                        <div className="tick-labels">
                          {scale.ticks
                            .filter((tick) => tick.major)
                            .map((tick) => (
                              <span
                                key={tick.value}
                                style={{ left: `${tick.position * 100}%` }}
                              >
                                {compact(tick.value)}
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>
                    {editable && (
                      <>
                        <div className="range-cue" role="status">
                          {dragCue}
                        </div>
                      </>
                    )}
                  </section>
                  {editable ? (
                    <>
                      <p className="entry-error" role="status">
                        {error}
                      </p>
                      <HoldToConfirm
                        onConfirm={() => void submit()}
                        revision={`${index}:${bounds.lower}:${bounds.upper}`}
                        disabled={help || editing !== null}
                      />
                    </>
                  ) : stage === "saving" ? (
                    <p className="scan-message" role="status">
                      Saving…
                    </p>
                  ) : stage === "sweeping" ? (
                    <p className="scan-message" role="status">
                      Revealing…
                    </p>
                  ) : (
                    <section className="reveal" aria-live="polite">
                      <p className="sr-only">Actual value: {formatEntry(String(question.answer))} {question.unit}.</p>
                      <div className="round-score">
                        <strong>{scoreText(points(result))}</strong>
                        <span>{demo ? "practice points" : "points"}</span>
                      </div>
                      {assisted && <p className="outcome">Hint used</p>}
                      <details className="source-detail">
                        <summary>Behind the number</summary>
                        <p>{question.context}</p>
                        <SourceLinks
                          urls={question.url}
                          names={question.source}
                        />
                      </details>
                      <button className="primary" onClick={() => {
                        if (demo) { setStage("scoring"); focusHeading(); }
                        else next();
                      }}>
                        {demo ? "Next" : index === orderedQuestions.length - 1
                          ? onboarding ? "See summary" : "See score"
                          : "Next number"}{" "}
                        <span>→</span>
                      </button>
                    </section>
                  )}
                </>
              )}
              <ol className={onboarding ? 'progress onboarding-progress' : 'progress'} aria-label="Round progress">
                {(demo ? [] : orderedQuestions).map((q, i) => {
                  const r = visibleResults[i];
                  return (
                    <li
                      key={q.id}
                      className={`${i === index ? "current" : ""} ${r ? (r.hit ? "done hit" : "done miss") : ""}`}
                      aria-current={i === index ? "step" : undefined}
                    >
                      <span>{r ? (r.hit ? "✓" : "×") : i + 1}</span>
                      <span className="sr-only">
                        {r
                          ? r.hit
                            ? "In range"
                            : "Outside range"
                          : i === index
                            ? "Current question"
                            : "Upcoming question"}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </>
          ) : cardData ? (
            <ScoreStory results={results} standings={standings} cardData={cardData} onboarding={onboarding}
              dailyAvailable={dailyAvailable} onPlayDaily={() => void startSession(false, true)} onPractice={restart} />
          ) : null}

        </main>
        {demo && practiceTip && <PracticeTip step={practiceTip} onDismiss={() => { setPracticeTip(null); focusHeading(); }} />}
        {["estimate", "range", "saving", "sweeping", "revealed", "complete"].includes(stage) && <BottomNav initialPanel={preview?.menu} score={totalPoints(visibleResults)} onOpenChange={open => {
          dragCleanup.current?.();
          feedback.stop();
          setHelp(open);
        }} />}
        <dialog
          ref={editDialog}
          className="edit-dialog"
          onCancel={() => {
            setEditing(null);
            setError("");
          }}
        >
          <div className="dialog-head">
            <h2>Edit {editing}{editing !== "estimate" && " bound"}</h2>
            <button
              aria-label="Cancel bound edit"
              onClick={() => {
                setEditing(null);
                setError("");
              }}
            >
              ×
            </button>
          </div>
          {editing && (
            <NumberPad
              value={editText}
              onChange={(v) => {
                setEditText(v);
                setError("");
              }}
              onSubmit={saveBound}
              label={editing === "estimate" ? "Your estimate" : `${editing === "lower" ? "Lower" : "Upper"} bound`}
              unit={question.unit}
              error={error}
              submitLabel={editing === "estimate" ? "Save estimate" : "Save bound"}
            />
          )}
        </dialog>
        <AuthModal
          isOpen={authOpen}
          onClose={() => setAuthOpen(false)}
          initialMode="login"
        />
      </div>
    </div>
  );
}
