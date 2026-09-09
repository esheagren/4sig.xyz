import { useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  KeyboardEvent,
} from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useAnalytics } from "../../context/PostHogContext";
import { getDeviceId } from "../../lib/device";
import { AuthModal } from "../nav/AuthModal";
import type { Question, Result } from "./game";
import "./style.css";
import "./onboarding.css";
import { CalibrationScore } from './CalibrationScore';
import { PlayerIdentity, PlayerMark } from "./PlayerIdentity";
import {
  validPlayerIcon,
  normalizeColor,
  normalizeIcon,
  playerLabel,
  colorName,
} from "./player";
import type { Player, SharedScore } from "./player";
import { QuestionText } from "./QuestionText";
import type { GlossaryAnnotation } from "../../lib/glossary";
import { NumberPad } from "./NumberPad";
import { SourceLinks } from "./SourceLinks";
import {
  compact,
  fitDomain,
  initialBounds,
  makeShareText,
  parseAmount,
  points,
  precise,
  quantity,
  scoreText,
  totalPoints,
  validBounds,
} from "./game";
import type { Bounds } from "./game";
import { HoldToConfirm } from "./HoldToConfirm";
import { rulerScale } from "./ruler-scale";
import { startDrag, stepDrag } from "./range-drag";
import { FEEDBACK_KEY, RulerFeedback, RulerTickGate } from "./ruler-feedback";

// The current question bank is curated for nonnegative quantities.
const RANGE_MIN = 0;
const DEMO_QUESTION: Question = { id: 'practice', title: 'How many minutes are in one day?', short: 'Minutes in a day', unit: 'minutes', answer: 1440, category: 'Practice', date: '', scale: 1, source: '', url: '', context: '' };
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
  | "practice-complete"
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
      category: j.topic ?? "Daily",
      date: j.observationPeriod ?? "",
      scale: 1,
    },
  };
}
type Standings = {
  dailyRank?: number | null;
  todaysAverage?: number | null;
  totalParticipantsToday?: number;
  todayLeaderboard?: Array<{
    rank: number;
    username: string;
    score: number;
    avatarIcon?: string;
    avatarColor?: string;
  }>;
};
export default function IntervalGame() {
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
    [savedCount, setSavedCount] = useState(0),
    [dailyAvailable, setDailyAvailable] = useState(false);
  const finalizing = useRef(false);
  const [standings, setStandings] = useState<Standings | null>(null),
    [authOpen, setAuthOpen] = useState(false);
  const starting = useRef(false);
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
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return localStorage.getItem(FEEDBACK_KEY) !== "off";
    } catch {
      return true;
    }
  });
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
  function toggleSound() {
    const enabled = !soundOn;
    feedback.enabled = enabled;
    setSoundOn(enabled);
    try {
      localStorage.setItem(FEEDBACK_KEY, enabled ? "on" : "off");
    } catch {
      /* Optional preference storage. */
    }
    if (enabled) feedback.unlock();
    else feedback.stop();
  }
  const [assisted, setAssisted] = useState(false),
    [error, setError] = useState(""),
    [help, setHelp] = useState(false);
  const [editing, setEditing] = useState<"lower" | "upper" | null>(null),
    [editText, setEditText] = useState("");
  const [player, setPlayer] = useState<Player | null>(null);
  const [share, setShare] = useState<SharedScore | null>(null);
  const [motionPaused, setMotionPaused] = useState(false);
  const shareUrl = share
    ? `https://4sig.xyz/share/${share.id}`
    : "https://4sig.xyz/";
  const initialPlayer: Partial<Player> = {
    ...(!user?.isAnonymous && user ? { username: user.displayName } : {}),
    ...(user?.hasPersonality ? { icon: normalizeIcon(user.avatarIcon), color: normalizeColor(user.avatarColor) } : {}),
  };
  const [copyToast, setCopyToast] = useState<{
    x: number;
    y: number;
    key: number;
  } | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    copySequence = useRef(0);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "fallback">(
    "idle",
  );
  const ruler = useRef<HTMLDivElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const [menuTab, setMenuTab] = useState<
    "play" | "profile" | "settings" | "about"
  >("play");
  const helpDialog = useRef<HTMLDialogElement>(null),
    editDialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false),
    dragCleanup = useRef<(() => void) | null>(null);
  const question = demo ? DEMO_QUESTION : results[index]?.question ?? orderedQuestions[index],
    editable = stage === "range",
    showAnswer = stage === "sweeping" || stage === "revealed";
  const result = results[index],
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
    if (help) helpDialog.current?.showModal();
    else helpDialog.current?.close();
  }, [help]);
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
    focusHeading();
  }
  function saveBound() {
    if (!editing) return;
    const value = parseAmount(editText),
      b = { ...bounds, [editing]: value };
    b.estimate = Math.max(b.lower, Math.min(b.upper, b.estimate));
    if (!validBounds(b, question.max, RANGE_MIN)) {
      setError(
        `Bounds must be at or above 0, with lower no greater than upper${question.max ? `, at or below ${question.max}` : ""}.`,
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
    const b = {
      ...bounds,
      [part]: precise(
        Math.max(domain[0], Math.min(domain[1], bounds[part] + delta)),
      ),
    };
    b.estimate = Math.max(b.lower, Math.min(b.upper, b.estimate));
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
    if (demo) { setStage('practice-complete'); lock.current = false; focusHeading(); return; }
    setStage("saving");
    try {
      const data = await request("session/answer", {
        sessionId,
        questionId: question.id,
        lower: bounds.lower,
        upper: bounds.upper,
      });
      if (onboarding) {
        const count = data.savedAnswers?.length;
        if (!Number.isInteger(count) || count < index + 1) throw new Error('Your answer could not be confirmed. Try again.');
        setSavedCount(count);
        if (count === orderedQuestions.length) finish();
        else { setIndex(count); resetRound(); }
        capture('onboarding_answer_saved', { sessionId, questionId: question.id, position: count });
        return;
      }
      if (!data.judgement)
        throw new Error("Your answer could not be confirmed. Try again.");
      setResults((r) => [...r, toResult(data.judgement)]);
      setStage("sweeping");
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
      setShare(data.share);
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
      setShare(null);
      setStandings(null);
      const saved: Result[] = (data.judgements ?? []).map(toResult);
      setResults(saved);
      const answered = data.savedAnswers?.length ?? saved.length;
      setSavedCount(answered);
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
        setShare(completed.share);
        setRanked(completed.isRanked);
        setPlayer(completed.share.player);
        setStandings(completed.dailyStats ?? null);
        setStage("complete");
        activeGame(null);
        void refreshUser();
      } else if (isOnboarding && answered === 0 && !tutorialSeen(data.sessionId)) {
        setStage('welcome'); focusHeading();
      } else resetRound();
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
          color: normalizeColor(user.avatarColor),
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
    if (copyTimer.current) clearTimeout(copyTimer.current);
    setCopyToast(null);
    setCopyState("idle");
    void startSession(true);
  }
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
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
    });
    if (!validPlayerIcon(data.user?.avatarIcon))
      throw new Error("Your personality could not be saved.");
    setPlayer({
      username: data.user.displayName,
      icon: data.user.avatarIcon,
      color: normalizeColor(data.user.avatarColor),
    });
    void refreshUser();
    await finalizeScore();
  }
  async function copy(e: React.MouseEvent<HTMLButtonElement>) {
    if (!player) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(
      85,
      Math.min(
        window.innerWidth - 85,
        e.detail ? e.clientX : rect.left + rect.width / 2,
      ),
    );
    const y = Math.max(
      54,
      Math.min(window.innerHeight - 30, e.detail ? e.clientY : rect.top),
    );
    try {
      await navigator.clipboard.writeText(
        makeShareText(
          results,
          shareUrl,
          player,
          onboarding ? 'Your first ten' + (isRanked ? '' : ' · Practice') : edition + (isRanked ? "" : " · Practice"),
        ),
      );
      setCopyState("copied");
      setCopyToast({ x, y, key: ++copySequence.current });
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => {
        setCopyToast(null);
        setCopyState("idle");
      }, 1800);
    } catch {
      setCopyState("fallback");
      setCopyToast(null);
    }
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
        const b = { ...v, estimate: (v.lower + v.upper) / 2 };
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
    <div className="interval-page">
      <div
        className="interval-app"
        style={
          {
            "--player-color":
              player?.color ?? normalizeColor(user?.avatarColor),
          } as CSSProperties
        }
      >
        {["estimate", "range", "saving", "sweeping", "revealed"].includes(
          stage,
        ) && (
          <header className="topbar">
            <span
              className="running-score"
              aria-label={onboarding ? "Your first ten" : `Score ${scoreText(totalPoints(visibleResults))} points`}
            >
              {onboarding ? <small>{demo ? 'Unscored practice' : 'Your first ten'}</small> : <>{scoreText(totalPoints(visibleResults))}<small>pts</small></>}
            </span>
            <button
              className="help-button"
              onClick={() => {
                dragCleanup.current?.();
                feedback.stop();
                setMenuTab("play");
                setHelp(true);
              }}
              aria-label="Open menu"
              aria-haspopup="dialog"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </header>
        )}
        <main>
          {stage === 'welcome' ? (
            <section className="onboarding-welcome">
              <h1 className="welcome-heading" ref={heading} tabIndex={-1}>
                <span>Welcome to</span>
                <span className="brand" aria-label="Four Sigma">4<span>σ</span></span>
              </h1>
              <p>Make sense of the numbers shaping our world—and find out how sure you should be.</p>
              <button className="primary" onClick={() => { setDemo(true); resetRound(); }}>Let’s play <span>→</span></button>
            </section>
          ) : stage === 'practice-complete' ? (
            <section className="onboarding-welcome">
              <p className="onboarding-eyebrow">PRACTICE COMPLETE · NO POINTS COUNTED</p>
              <h1 ref={heading} tabIndex={-1}>You have the controls.</h1>
              <p>A day contains 1,440 minutes. Your range was {quantity(bounds.lower, 'minutes')} to {quantity(bounds.upper, 'minutes')}.</p>
              <p>{bounds.lower <= 1440 && bounds.upper >= 1440 ? 'Your range contained the answer.' : 'The answer fell outside your range.'} Over time, aim to contain the answer about 19 times out of 20.</p>
              <p>A narrower range earns more points when it contains the answer. For your first ten, the answers and your score will be revealed together at the end.</p>
              <button className="primary" onClick={() => { tutorialSeen(sessionId, true); setDemo(false); setIndex(0); resetRound(); }}>Begin question one <span>→</span></button>
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
              {onboarding && !demo && <p className="onboarding-eyebrow" role="status">Your first ten · Question {index + 1} of {orderedQuestions.length} · {question.category}</p>}
              {demo && <p className="onboarding-coach">{stage === 'estimate' ? 'First, enter your best estimate. Then choose Set range.' : 'Drag the L and U brackets, or tap a bound to type it. Hold the round arrow for half a second to submit.'}</p>}
              <section className="question-block" key={question.id}>
                <h1 ref={heading} tabIndex={-1}>
                  <QuestionText
                    text={question.title}
                    glossary={demo ? undefined : orderedQuestions[index]?.glossary}
                  />
                </h1>
                {question.date && <p className="date">{question.date}</p>}
              </section>
              {stage === "estimate" ? (
                <section className="estimate-panel">
                  <NumberPad
                    value={text}
                    onChange={(v) => {
                      setText(v);
                      setError("");
                    }}
                    onSubmit={beginRange}
                    label="Your estimate"
                    unit={question.unit}
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
                    className={`instrument ${showAnswer ? "locked" : ""}`}
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
                          <strong>{compact(bounds[part])}</strong>
                        </button>
                      ))}
                    </div>
                    <p className="range-unit">{question.unit}</p>
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
                          ◆
                        </div>
                        {(["lower", "upper"] as const).map((part) => (
                          <button
                            key={part}
                            className={`handle ${part}`}
                            style={{ left: `${clipped(bounds[part])}%` }}
                            role="slider"
                            aria-label={`Drag ${part} bound`}
                            aria-valuemin={
                              part === "lower"
                                ? Math.min(domain[0], bounds.lower)
                                : bounds.lower
                            }
                            aria-valuemax={
                              part === "upper"
                                ? (question.max ??
                                  Math.max(domain[1], bounds.upper))
                                : bounds.upper
                            }
                            aria-valuenow={bounds[part]}
                            aria-valuetext={quantity(
                              bounds[part],
                              question.unit,
                            )}
                            disabled={!editable}
                            onPointerDown={(e) => drag(e, part)}
                            onKeyDown={(e) => keyMove(e, part)}
                          >
                            <span>{part === "lower" ? "L" : "U"}</span>
                          </button>
                        ))}
                        {showAnswer && (
                          <div
                            className={`truth ${stage}`}
                            style={
                              {
                                "--truth-x": `${clipped(question.answer)}%`,
                              } as CSSProperties
                            }
                          >
                            <span>
                              {position(question.answer) < 0
                                ? "←"
                                : position(question.answer) > 100
                                  ? "→"
                                  : "●"}
                            </span>
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
                      <div className="answer-line">
                        <div>
                          <span className="small-label">ACTUAL VALUE</span>
                          <h2>
                            {compact(question.answer)}{" "}
                            <small>{question.unit}</small>
                          </h2>
                        </div>
                        <div className="round-score">
                          <strong>{scoreText(points(result))}</strong>
                          <span>pts</span>
                        </div>
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
                      <button className="primary" onClick={next}>
                        {index === orderedQuestions.length - 1
                          ? "See score"
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
                  if (onboarding) return <li key={q.id} className={i === index ? 'current' : i < savedCount ? 'done' : ''} aria-current={i === index ? 'step' : undefined}><span>{i + 1}</span><span className="sr-only">{i < savedCount ? 'Range saved' : i === index ? 'Current question' : 'Upcoming question'}</span></li>;
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
          ) : (
            <section className="summary">
              <div className="result-brand brand" aria-label="Four Sigma">
                4<span>σ</span>
              </div>
              <div className="result-person">
                {player && (
                  <>
                    <PlayerMark
                      icon={player.icon}
                      color={player.color}
                      paused={motionPaused}
                    />
                    <span>{player.username}</span>
                    <button
                      className="text-button motion-toggle"
                      aria-label={
                        motionPaused
                          ? "Play identity animation"
                          : "Pause identity animation"
                      }
                      aria-pressed={motionPaused}
                      onClick={() => setMotionPaused(!motionPaused)}
                    >
                      {motionPaused ? "▷" : "Ⅱ"}
                    </button>
                  </>
                )}
              </div>
              {player && (
                <p className="personality-signature">
                  {playerLabel(player.icon)} · {colorName(player.color)}
                </p>
              )}
              <h1 ref={heading} tabIndex={-1}>
                {onboarding ? (isRanked ? 'Your starting snapshot' : 'Your first ten · Practice') : isRanked ? "Your score" : "Practice score"}
              </h1>
              <CalibrationScore score={totalPoints(results)} hits={results.filter(r => r.hit).length} count={results.length} initial={onboarding} />
              {!isRanked && <p className="summary-caption">Practice: excluded from your totals.</p>}
              {onboarding && <div className="daily-invitation">
                <p>{dailyAvailable ? 'Four more numbers to explore. Your original ten stay here as your baseline.' : 'Your first ten are complete. Four new questions arrive tomorrow, on the Pacific daily schedule.'}</p>
                {dailyAvailable && <button className="primary" onClick={() => void startSession(false, true)}>Play today's four <span>→</span></button>}
                {(user?.questionsAnswered ?? 0) > results.length && <p className="onboarding-note">Overall: {scoreText(user!.totalScore)} points · {Math.round(user!.calibrationRate * 1000) / 10}% calibration across {user!.questionsAnswered} questions. Target: 95%.</p>}
              </div>}
              <div className="share-tiles" aria-hidden="true">
                {results.map((r, i) => (
                  <span
                    key={r.question.id}
                    style={{ animationDelay: `${150 + i * 65}ms` }}
                    className={r.hit ? "hit" : ""}
                  >
                    {r.hit ? "✓" : "×"}
                  </span>
                ))}
              </div>
              <div className="share-actions">
                <button className="primary" onClick={copy}>
                  Share Score<span aria-hidden="true">↗</span>
                </button>
              </div>
              <p className="copy-status" role="status">
                {copyState === "copied" ? (
                  <span className="sr-only">Score copied. Ready to paste.</span>
                ) : copyState === "fallback" ? (
                  "Select and copy your score below."
                ) : (
                  ""
                )}
              </p>
              {copyToast && (
                <div
                  key={copyToast.key}
                  className="copy-toast"
                  style={{ left: copyToast.x, top: copyToast.y }}
                  aria-hidden="true"
                >
                  {player && (
                    <PlayerMark icon={player.icon} color={player.color} />
                  )}
                  <span>Score copied</span>
                  <span>✓</span>
                </div>
              )}
              {copyState === "fallback" && player && (
                <textarea
                  className="share-fallback"
                  aria-label="Shareable score"
                  readOnly
                  value={makeShareText(
                    results,
                    shareUrl,
                    player,
                    onboarding ? 'Your first ten' + (isRanked ? '' : ' · Practice') : edition + (isRanked ? "" : " · Practice"),
                  )}
                  onFocus={(e) => e.target.select()}
                />
              )}
              <div className="result-list">
                {results.map((r, i) => (
                  <details key={r.question.id}>
                    <summary>
                      <span className={`result-dot ${r.hit ? "hit" : ""}`}>
                        {i + 1}
                      </span>
                      <span>
                        {r.question.short}
                        <small>
                          {r.assisted ? "Hint used" : r.question.category}
                        </small>
                      </span>
                      <strong>
                        {scoreText(points(r))}
                        <small>pts</small>
                      </strong>
                    </summary>
                    <div className="result-expanded">
                      <p>
                        Your range: {quantity(r.lower, r.question.unit)} –{" "}
                        {quantity(r.upper, r.question.unit)}
                      </p>
                      <p>
                        Actual:{" "}
                        <b>{quantity(r.question.answer, r.question.unit)}</b>
                      </p>
                      <p>{r.question.context}</p>
                      <SourceLinks
                        urls={r.question.url}
                        names={r.question.source}
                      />
                    </div>
                  </details>
                ))}
              </div>
              {standings && (
                <details className="standings-detail">
                  <summary>Today’s standings</summary>
                  <p>
                    {standings.dailyRank
                      ? `Your rank: ${standings.dailyRank}`
                      : "Your score is saved."}
                    {standings.todaysAverage != null
                      ? ` · Average: ${scoreText(standings.todaysAverage)} pts`
                      : ""}
                  </p>
                  {standings.todayLeaderboard?.length ? (
                    <ol>
                      {standings.todayLeaderboard.map((row) => (
                        <li key={row.username}>
                          <span className="standings-person">
                            <PlayerMark
                              icon={normalizeIcon(row.avatarIcon)}
                              color={normalizeColor(row.avatarColor)}
                              paused
                            />
                            {row.rank}. {row.username}
                          </span>
                          <strong>{scoreText(row.score)} pts</strong>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </details>
              )}
              <div className="summary-links">
                <Link className="text-button" to="/profile">
                  Your profile & history
                </Link>
                {!onboarding && <button className="text-button" onClick={restart}>Practice ↻</button>}
              </div>
            </section>
          )}
        </main>
        <dialog
          ref={helpDialog}
          className="help-dialog game-menu"
          aria-labelledby="game-menu-title"
          onCancel={() => setHelp(false)}
          onClick={(e) => {
            if (e.target === helpDialog.current) setHelp(false);
          }}
        >
          <div className="dialog-head">
            <h2
              id="game-menu-title"
              className="menu-brand brand"
              aria-label="Four Sigma"
            >
              4<span>σ</span>
            </h2>
            <button aria-label="Close menu" onClick={() => setHelp(false)}>
              ×
            </button>
          </div>
          <p className="menu-value-prop">
            A better sense of the world, four numbers at a time.
          </p>
          <div
            className="menu-tabs"
            role="tablist"
            aria-label="Four Sigma menu"
          >
            {(
              [
                ["play", "How to play"],
                ["profile", "Your profile"],
                ["settings", "Settings"],
                ["about", "About"],
              ] as const
            ).map(([id, label], index) => (
              <button
                key={id}
                id={`menu-tab-${id}`}
                role="tab"
                type="button"
                aria-selected={menuTab === id}
                aria-controls={`menu-panel-${id}`}
                tabIndex={menuTab === id ? 0 : -1}
                onClick={() => setMenuTab(id)}
                onKeyDown={(event) => {
                  const ids = ["play", "profile", "settings", "about"] as const;
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 3
                        : event.key === "ArrowRight"
                          ? (index + 1) % 4
                          : event.key === "ArrowLeft"
                            ? (index + 3) % 4
                            : null;
                  if (next === null) return;
                  event.preventDefault();
                  setMenuTab(ids[next]);
                  document.getElementById(`menu-tab-${ids[next]}`)?.focus();
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <section
            className="menu-panel"
            id="menu-panel-play"
            role="tabpanel"
            aria-labelledby="menu-tab-play"
            hidden={menuTab !== "play"}
            tabIndex={0}
          >
            <h3>How to play</h3>
            <p>
              Give your best estimate, then drag the brackets to choose a range
              you’re 95% confident contains the answer.
            </p>
            <p>
              Tap either bound to edit it. Hold a bracket at the edge to expand
              the ruler slowly. Hold the round arrow for half a second to commit
              your answer.
            </p>
            <p>
              Use 000 for thousands and millions, or E for scientific notation:
              4E5 = 400,000.
            </p>
            <h3>Scoring</h3>
            <p>
              If the answer falls outside your range, you earn 0 points. If it
              falls inside, a narrower range relative to the answer earns more
              points—up to 10,000 per question.
            </p>
            <p className="menu-formula">
              50 × (|answer| ÷ range width)<sup>0.7</sup>
            </p>
            <p>
              Exact guesses earn 10,000. A zero answer uses the question’s
              reference scale.
            </p>
            <p className="muted menu-edition-note">
              Start with ten shared questions and a calibration snapshot. Then explore four new numbers each day. Your first daily attempt counts toward your score; replays are practice.
            </p>
          </section>
          <section
            className="menu-panel"
            id="menu-panel-about"
            role="tabpanel"
            aria-labelledby="menu-tab-about"
            hidden={menuTab !== "about"}
            tabIndex={0}
          >
            <h3>Numbers that matter</h3>
            <p>
              Four Sigma is a daily game about the numbers that help you
              understand the world.
            </p>
            <p>
              Our questions explore how the world works and how it’s changing,
              with a few lasting yardsticks to give you a sense of scale.
            </p>
            <p>
              The aim is to leave you with something worth knowing. Make an
              estimate, consider how sure you are, then explore the answer and
              its source.
            </p>
          </section>
          <section
            className="menu-panel"
            id="menu-panel-profile"
            role="tabpanel"
            aria-labelledby="menu-tab-profile"
            hidden={menuTab !== "profile"}
            tabIndex={0}
          >
            {user && !user.isAnonymous ? (
              <>
                <div className="menu-profile-person">
                  <PlayerMark
                    icon={normalizeIcon(user.avatarIcon)}
                    color={normalizeColor(user.avatarColor)}
                  />
                  <strong>{user.displayName}</strong>
                </div>
                <dl className="menu-profile-stats">
                  <div>
                    <dt>Games played</dt>
                    <dd>{user.gamesPlayed}</dd>
                  </div>
                  <div>
                    <dt>Average score</dt>
                    <dd>{scoreText(user.averageScore)}</dd>
                  </div>
                  <div>
                    <dt>Current streak</dt>
                    <dd>
                      {user.currentStreak}{" "}
                      {user.currentStreak === 1 ? "day" : "days"}
                    </dd>
                  </div>
                </dl>
                <Link className="text-button" to="/profile">
                  Edit personality & view history ↗
                </Link>
              </>
            ) : (
              <>
                <h3>Make it yours</h3>
                <p>
                  After your first ten answers, choose a username, animated symbol,
                  and color to give your shared score a personality.
                </p>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setHelp(false)}
                >
                  Back to the game →
                </button>
              </>
            )}
          </section>
          <section
            className="menu-panel"
            id="menu-panel-settings"
            role="tabpanel"
            aria-labelledby="menu-tab-settings"
            hidden={menuTab !== "settings"}
            tabIndex={0}
          >
            <div className="menu-setting">
              <div>
                <span>Sound</span>
                <p>Soft ruler ticks and touch feedback.</p>
              </div>
              <button
                className="menu-switch"
                type="button"
                role="switch"
                aria-checked={soundOn}
                aria-label="Sound and vibration"
                onClick={toggleSound}
              >
                <span aria-hidden="true">{soundOn ? "On" : "Off"}</span>
                <i aria-hidden="true" />
              </button>
            </div>
          </section>
        </dialog>
        <dialog
          ref={editDialog}
          className="edit-dialog"
          onCancel={() => {
            setEditing(null);
            setError("");
          }}
        >
          <div className="dialog-head">
            <h2>Edit {editing} bound</h2>
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
              label={`${editing === "lower" ? "Lower" : "Upper"} bound`}
              unit={question.unit}
              error={error}
              submitLabel="Save bound"
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
