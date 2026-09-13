import type { GamePreview } from "../components/interval/IntervalGame";
export type Screen = {
  id: string;
  code: string;
  name: string;
  group: string;
  description: string;
  try: string;
  components: string[];
  kind?: "daily";
  answered?: number;
  member?: boolean;
  preview: GamePreview;
};
const practice = { lower: 1600, estimate: 1776, upper: 1900 };
export const screens: Screen[] = [
  {
    id: "welcome",
    code: "O01",
    name: "Welcome",
    group: "First visit",
    description:
      "The centered introduction, value proposition, and animated probability field.",
    try: "Tap the circle to begin the complete first-visit flow.",
    components: ["welcome-field", "brand", "round-action"],
    preview: { stage: "welcome" },
  },
  {
    id: "practice-estimate",
    code: "O02",
    name: "Practice · estimate",
    group: "First visit",
    description: "The first estimate, introduced by a centered practice tip.",
    try: "Dismiss the tip, type a number, and choose Set range. The computer keyboard works too.",
    components: ["practice-tip", "number-pad", "question"],
    preview: { stage: "estimate", demo: true, tip: "estimate" },
  },
  {
    id: "practice-range",
    code: "O03",
    name: "Practice · range",
    group: "First visit",
    description:
      "The 95% confidence instruction introduces holding Submit for half a second.",
    try: "Close the tip, move either bracket, and hold the round button.",
    components: ["practice-tip", "range", "hold-submit"],
    preview: { stage: "range", demo: true, tip: "range", bounds: practice },
  },
  {
    id: "practice-answer",
    code: "O04",
    name: "Practice · answer",
    group: "First visit",
    description:
      "The actual answer and earned points use the regular game reveal.",
    try: "Next leads to the visual scoring explanation.",
    components: ["answer-pin", "range", "points"],
    preview: { stage: "revealed", demo: true, bounds: practice },
  },
  {
    id: "scoring",
    code: "O05",
    name: "How scoring works",
    group: "First visit",
    description:
      "Wide, close, very close, exact, and miss share a single aligned answer marker.",
    try: "Compare the five examples, then move to the topics.",
    components: ["scoring-examples"],
    preview: { stage: "scoring" },
  },
  {
    id: "worldview",
    code: "O06",
    name: "The numbers we focus on",
    group: "First visit",
    description: "The nine topic areas and the mesofacts we focus on.",
    try: "Start today’s questions opens the first of five daily questions.",
    components: ["worldview-grid"],
    preview: { stage: "worldview" },
  },
  {
    id: "calibration-estimate",
    code: "Q01",
    name: "First daily question",
    group: "Question loop",
    description:
      "Five shared daily questions, with an answer revealed after each submission.",
    try: "Enter an estimate with either keyboard, then set your range.",
    components: ["question", "number-pad", "bottom-nav"],
    preview: { stage: "estimate" },
  },
  {
    id: "daily-estimate",
    code: "Q02",
    name: "Daily · estimate",
    group: "Question loop",
    kind: "daily",
    member: true,
    description:
      "Returning players start here when the next daily edition is available.",
    try: "Enter a number. There is no repeated tutorial.",
    components: ["question", "number-pad", "bottom-nav"],
    preview: { stage: "estimate" },
  },
  {
    id: "calculator",
    code: "Q03",
    name: "Calculator",
    group: "Question loop",
    kind: "daily",
    member: true,
    description: "Calculations write directly into the estimate line.",
    try: "Try 40 + 40, then use the normal Set range button. Toggle back to numbers.",
    components: ["number-pad"],
    preview: { stage: "estimate", calculator: true },
  },
  {
    id: "range",
    code: "Q04",
    name: "Set a range",
    group: "Question loop",
    kind: "daily",
    member: true,
    description:
      "Brackets move horizontally around the fixed estimate. The page stays vertically stable.",
    try: "Drag brackets, edit either bound, or hold Submit. Pull both brackets onto the estimate for an exact answer.",
    components: ["range", "hold-submit", "bottom-nav"],
    preview: { stage: "range", bounds: { lower: 60, estimate: 80, upper: 95 } },
  },
  {
    id: "answer-hit",
    code: "Q05",
    name: "Answer · captured",
    group: "Question loop",
    kind: "daily",
    member: true,
    answered: 1,
    description:
      "The answer pin and the points appear directly on and below the number line.",
    try: "Next opens the next unanswered question.",
    components: ["answer-pin", "points", "range"],
    preview: {
      stage: "revealed",
      bounds: { lower: 60, estimate: 80, upper: 95 },
    },
  },
  {
    id: "answer-miss",
    code: "Q06",
    name: "Answer · missed",
    group: "Question loop",
    kind: "daily",
    member: true,
    answered: 1,
    description: "An answer outside the submitted interval earns zero points.",
    try: "Compare the missed interval with the captured-answer screen.",
    components: ["answer-pin", "points", "range"],
    preview: {
      stage: "revealed",
      bounds: { lower: 81, estimate: 82, upper: 85 },
    },
  },
  {
    id: "exact-range",
    code: "Q07",
    name: "Exact answer",
    group: "Question loop",
    kind: "daily",
    member: true,
    description:
      "Both brackets meet at the original estimate, showing the limits of movement.",
    try: "Pull a bracket outward to restore a range, or hold Submit to commit the exact answer.",
    components: ["range", "hold-submit"],
    preview: { stage: "range", bounds: { lower: 80, estimate: 80, upper: 80 } },
  },
  {
    id: "claim",
    code: "R01",
    name: "Claim username",
    group: "Results & identity",
    answered: 5,
    description:
      "Choose a username, one of eight styles, and a color beneath the pattern choices.",
    try: "Try a name and change the style. All saves here are simulated.",
    components: ["personality", "scorecard"],
    preview: { stage: "identity" },
  },
  {
    id: "starting-score",
    code: "R02",
    name: "First daily scorecard",
    group: "Results & identity",
    answered: 5,
    member: true,
    description:
      "A dark, animated first daily score with a thumb-level Share action, followed by a separate question-review page.",
    try: "Scroll or tap Today’s questions to snap to the review. Return with Your score. Share copies the chosen GIF and homepage URL.",
    components: [
      "score-story",
      "scorecard",
      "share",
      "answer-review",
      "bottom-nav",
    ],
    preview: { stage: "complete" },
  },
  {
    id: "daily-score",
    code: "R03",
    name: "Daily scorecard",
    group: "Results & identity",
    kind: "daily",
    answered: 5,
    member: true,
    description:
      "An animated daily score with percentile, rank, and comparison with today’s average, plus calibration against 95%; snap down to Today’s questions.",
    try: "Scroll to snap between the dark result and Today’s questions. Expand an insight, return to your score, or share the GIF. Daily comparisons use sample standings: 12th of 128, ahead of 91%, and 28% above today’s mean.",
    components: [
      "score-story",
      "daily-comparison",
      "scorecard",
      "share",
      "answer-review",
      "bottom-nav",
    ],
    preview: { stage: "complete" },
  },
  ...(["stats", "profile", "settings", "play"] as const).map((tab, i) => ({
    id: "menu-" + tab,
    code: "M0" + (i + 1),
    name: ["Stats", "Profile", "Settings", "How to play"][i],
    group: "Player menu",
    kind: "daily" as const,
    member: true,
    description: [
      "Points, calibration, streaks, and expandable history.",
      "Your username, animated mark, style, and account.",
      "Sound and vibration preferences.",
      "The purpose of the game and the complete playing instructions.",
    ][i],
    try: "Switch between the four tabs. Close the panel to return to the game.",
    components: ["player-menu", "bottom-nav"],
    preview: { stage: "estimate" as const, menu: tab },
  })),
  {
    id: "sign-in",
    code: "M05",
    name: "Sign in",
    group: "Player menu",
    description:
      "The existing-account dialog, available from the identity flow.",
    try: "Use any sample email and password to preview signing in. Nothing is sent to an account service.",
    components: ["auth-dialog"],
    answered: 5,
    preview: { stage: "identity", auth: true },
  },
  {
    id: "guest-menu",
    code: "M06",
    name: "Guest profile",
    group: "Player menu",
    description:
      "The profile before a player has finished calibration and claimed a name.",
    try: "Switch tabs to see the guest information states.",
    components: ["player-menu", "bottom-nav"],
    preview: { stage: "estimate", menu: "profile" },
  },
  {
    id: "loading",
    code: "X01",
    name: "Loading a game",
    group: "System states",
    member: true,
    kind: "daily",
    description: "The loading state while a game is being prepared.",
    try: "This preview holds the loading state. Select another screen to continue.",
    components: [],
    preview: { stage: "loading" },
  },
  {
    id: "unavailable",
    code: "X02",
    name: "Connection problem",
    group: "System states",
    description: "The recoverable error state when a game cannot be loaded.",
    try: "Try again succeeds with sample data.",
    components: [],
    preview: {},
  },
];
export const components = [
  {
    id: "daily-comparison",
    name: "Daily comparisons",
    source: "DailyCompetition",
    description:
      "Percent of other finishers scored below you, daily rank, and percentage difference from today's mean. Comparisons cover completed ranked daily games so far. Exact ties are not counted as beaten; percentiles wait for 20 players.",
    screen: "daily-score",
  },
  {
    id: "score-story",
    name: "Two-page score",
    source: "ScoreStory",
    description:
      "A full-height, animated result in the player’s color, with a 95% calibration target and Share at the bottom. Scroll snaps to Today’s questions; its longer review scrolls freely.",
    screen: "daily-score",
  },
  {
    id: "answer-review",
    name: "Answer review",
    source: "AnswerReview / AnswerRange",
    description:
      "The live range and actual-answer graphic, with concise context that expands into further detail and sources.",
    screen: "starting-score",
  },
  {
    id: "brand",
    name: "4σ mark",
    source: "BottomNav / Welcome",
    description:
      "The same typographic mark, large at welcome and small in the bottom bar.",
    screen: "welcome",
  },
  {
    id: "welcome-field",
    name: "Probability field",
    source: "WelcomeProbability",
    description:
      "A responsive animated field behind the centered introduction.",
    screen: "welcome",
  },
  {
    id: "round-action",
    name: "Round action",
    source: "IntervalGame / HoldToConfirm",
    description:
      "The circular action language used for Let’s play, Submit, and Share.",
    screen: "welcome",
  },
  {
    id: "practice-tip",
    name: "Practice tip",
    source: "PracticeTip",
    description:
      "Centered, dismissible guidance at the first estimate and first range.",
    screen: "practice-range",
  },
  {
    id: "question",
    name: "Question & unit",
    source: "QuestionText",
    description:
      "A word-count-aware heading, glossary terms, and a separate unit badge.",
    screen: "daily-estimate",
  },
  {
    id: "number-pad",
    name: "Number pad & calculator",
    source: "NumberPad",
    description:
      "Two coordinated keyboards with one answer line and physical keyboard support.",
    screen: "calculator",
  },
  {
    id: "range",
    name: "Confidence ruler",
    source: "IntervalGame / ruler-scale / range-drag",
    description:
      "Two bounds around a fixed estimate, with horizontal drag and exact-answer limits.",
    screen: "range",
  },
  {
    id: "hold-submit",
    name: "Hold to submit",
    source: "HoldToConfirm",
    description:
      "A half-second hold with progress around the circle. Early release cancels.",
    screen: "range",
  },
  {
    id: "answer-pin",
    name: "Answer pin",
    source: "IntervalGame",
    description:
      "The true value sits on a short pin at its position on the number line.",
    screen: "answer-hit",
  },
  {
    id: "points",
    name: "Round points",
    source: "IntervalGame",
    description:
      "The score sits below the ruler and contributes to the running round total.",
    screen: "answer-hit",
  },
  {
    id: "scoring-examples",
    name: "Scoring examples",
    source: "ScoringExamples",
    description:
      "Five intervals on one scale, including the exact and narrowly missed answers.",
    screen: "scoring",
  },
  {
    id: "worldview-grid",
    name: "Topic grid",
    source: "WorldviewGrid",
    description:
      "Nine icon-and-label pairs describing the kinds of numbers we focus on.",
    screen: "worldview",
  },
  {
    id: "personality",
    name: "Style & color picker",
    source: "PersonalityPicker / PlayerMark",
    description:
      "Eight coherent compositions, with color as a subsection below the styles.",
    screen: "claim",
  },
  {
    id: "scorecard",
    name: "Ink scorecard",
    source: "ScoreCard / ink-collection",
    description:
      "One animated signature containing the player’s name, score, and calibration.",
    screen: "starting-score",
  },
  {
    id: "share",
    name: "Share & confirmation",
    source: "ScorecardShare",
    description:
      "Copies the scorecard image and the homepage URL, with a transient clipboard confirmation.",
    screen: "starting-score",
  },
  {
    id: "bottom-nav",
    name: "Bottom bar",
    source: "BottomNav",
    description:
      "A thin bar with the mark, running points, and three-bar menu.",
    screen: "daily-estimate",
  },
  {
    id: "player-menu",
    name: "Player panel",
    source: "PlayerPanel",
    description:
      "Stats, Profile, Settings, and How to play in one four-tab panel.",
    screen: "menu-stats",
  },
  {
    id: "auth-dialog",
    name: "Account dialog",
    source: "AuthModal",
    description: "Sign in and add-account states, with inline validation.",
    screen: "sign-in",
  },
];
export const screenById = (id: string | null) =>
  screens.find((s) => s.id === (id === "setup" ? "worldview" : id)) ?? screens[0];
