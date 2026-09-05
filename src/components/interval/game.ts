import { playerSymbol } from "./player";
import type { Player } from "./player";
export type Question = {
  id: string;
  category: string;
  tags?: string[];
  magnitude?: boolean;
  hint?: string;
  title: string;
  short: string;
  date: string;
  unit: string;
  answer: number;
  max?: number;
  scale: number;
  source: string;
  url: string;
  context: string;
};
export type Bounds = { lower: number; estimate: number; upper: number };
export type Result = Bounds & {
  question: Question;
  hit: boolean;
  score: number;
  assisted: boolean;
};
export const format = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 }).format(n);
export function validBounds(b: Bounds, max = 1e100) {
  return (
    Object.values(b).every(Number.isFinite) &&
    b.lower >= -1e100 &&
    b.lower <= b.upper &&
    b.lower <= b.estimate &&
    b.estimate <= b.upper &&
    b.upper <= max
  );
}
export function parseAmount(text: string, multiplier = 1): number {
  const clean = text.trim().replaceAll(",", "");
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(clean)) return NaN;
  const value = Number(clean) * multiplier;
  return Number.isFinite(value) &&
    Math.abs(value) <= 1e100 &&
    (value === 0
      ? !/[1-9]/.test(clean.split(/[eE]/)[0])
      : Math.abs(value) >= 1e-100)
    ? value
    : NaN;
}
export const precise = (value: number) => Number(value.toPrecision(10));
export function initialBounds(estimate: number, max = 1e100): Bounds {
  if (!Number.isFinite(estimate) || estimate < -1e100 || estimate > max)
    throw new Error("Invalid estimate");
  const pad = Math.abs(estimate) * 0.5 || 0.5;
  return {
    lower: precise(Math.max(-1e100, estimate - pad)),
    estimate,
    upper: precise(Math.min(max, estimate + pad)),
  };
}
// Uses only the player's interval and the natural domain; never the hidden answer.
export function fitDomain(b: Bounds, max = 1e100): [number, number] {
  const pad = Math.max(
    (b.upper - b.lower) * 0.35,
    Math.abs(b.estimate) * 0.05,
    b.lower === 0 && b.upper === 0 ? 0.5 : 1e-102,
  );
  const step = 10 ** Math.floor(Math.log10((b.upper - b.lower + 2 * pad) / 4));
  return [
    precise(Math.max(-1e100, Math.floor((b.lower - pad) / step) * step)),
    precise(Math.min(max, Math.ceil((b.upper + pad) / step) * step)),
  ];
}
export function resizeBounds(b: Bounds, factor: number, max = 1e100): Bounds {
  if (b.lower === b.upper && factor > 1) {
    const pad = b.estimate !== 0 ? Math.abs(b.estimate) * 0.05 : 0.5;
    return {
      lower: precise(Math.max(-1e100, b.estimate - pad)),
      estimate: b.estimate,
      upper: precise(Math.min(max, b.estimate + pad)),
    };
  }
  const lower = precise(
    Math.max(-1e100, b.estimate - (b.estimate - b.lower) * factor),
  );
  const upper = precise(
    Math.min(max, b.estimate + (b.upper - b.estimate) * factor),
  );
  const next = { lower, estimate: b.estimate, upper };
  return validBounds(next, max) ? next : b;
}
const multipliers = [
  { value: 1, label: "units" },
  { value: 1e3, label: "thousand" },
  { value: 1e6, label: "million" },
  { value: 1e9, label: "billion" },
  { value: 1e12, label: "trillion" },
  { value: 1e15, label: "quadrillion" },
];
export function quantity(value: number, unit: string): string {
  const magnitude =
    [...multipliers].reverse().find((m) => Math.abs(value) >= m.value) ??
    multipliers[0];
  return `${format(value / magnitude.value)}${magnitude.value === 1 ? "" : " " + magnitude.label} ${unit}`;
}

export const points = (result: Result) => result.score;
export const totalPoints = (results: Result[]) =>
  Math.round(results.reduce((sum, r) => sum + points(r), 0) * 10) / 10;
export const scoreText = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
export const compact = (value: number) =>
  Math.abs(value) >= 1e15 || (Math.abs(value) > 0 && Math.abs(value) < 0.001)
    ? value
        .toExponential(2)
        .replace(/\.?0+e/, "e")
        .replace("e+", "E")
        .replace("e", "E")
    : new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumSignificantDigits: 4,
      }).format(value);
export function extendUpper(
  b: Bounds,
  domain: [number, number],
  seconds: number,
  max = 1e100,
): { bounds: Bounds; domain: [number, number] } {
  const span = domain[1] - domain[0];
  const upper = precise(
    Math.min(max, b.upper + span * Math.max(0, seconds) * 0.85),
  );
  return {
    bounds: { ...b, upper },
    domain: [domain[0], Math.min(max, Math.max(domain[1], upper + span * 0.1))],
  };
}
export function makeShareText(
  results: Result[],
  url: string,
  player?: Player,
  edition = "Daily",
) {
  return `4σ · ${edition}\n${player ? `${playerSymbol(player.icon)} ${player.username}\n` : ""}${scoreText(totalPoints(results))} pts · ${results.filter((r) => r.hit).length}/${results.length} in range\n${results.map((r) => (r.hit ? "🟩" : "⬜")).join("")}\n${url}`;
}
