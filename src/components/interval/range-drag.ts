import { precise } from "./game";
import type { Bounds } from "./game";

// Keep the estimate fixed, including digits beyond the ruler's display precision.
export function moveBound(bounds: Bounds, part: "lower" | "upper", value: number, min = 0, max = 1e100): Bounds {
  return { ...bounds, [part]: part === "lower"
    ? Math.max(min, Math.min(bounds.estimate, precise(value)))
    : Math.min(max, Math.max(bounds.estimate, precise(value))) };
}

export type DragState = {
  bounds: Bounds;
  domain: [number, number];
  part: "lower" | "upper";
  initialSpan: number;
  expanded: number;
  edgeSeconds: number;
  cue: string;
};

export function startDrag(
  bounds: Bounds,
  domain: [number, number],
  part: DragState["part"],
): DragState {
  return {
    bounds: { ...bounds },
    domain: [...domain],
    part,
    initialSpan: domain[1] - domain[0],
    expanded: 0,
    edgeSeconds: 0,
    cue: "",
  };
}

// Speed and the expansion budget are fixed at pointer-down, never compounded.
export function stepDrag(
  state: DragState,
  ratio: number,
  seconds: number,
  moved: boolean,
  min = 0,
  max = 1e100,
): DragState {
  const next = {
    ...state,
    domain: [...state.domain] as [number, number],
    bounds: { ...state.bounds },
    cue: "",
  };
  const upper = state.part === "upper";
  const atEdge = moved && (upper ? ratio >= 0.98 : ratio <= 0.02);
  const room = upper ? max - state.domain[1] : state.domain[0] - min;
  const remaining = Math.max(0, state.initialSpan - state.expanded);
  if (atEdge && room > 0 && remaining > 0) {
    next.edgeSeconds += Math.max(0, Math.min(seconds, 0.05));
    const activeSeconds =
      Math.max(0, next.edgeSeconds - 0.75) -
      Math.max(0, state.edgeSeconds - 0.75);
    const expansion = Math.min(
      room,
      remaining,
      state.initialSpan * 0.12 * activeSeconds,
    );
    if (upper) next.domain[1] = Math.min(max, state.domain[1] + expansion);
    else next.domain[0] = Math.max(min, state.domain[0] - expansion);
    next.expanded += expansion;
    next.cue =
      next.expanded >= state.initialSpan
        ? "Release to expand further"
        : next.edgeSeconds <= 0.75
          ? "Hold to expand"
          : "Expanding slowly";
  } else {
    next.edgeSeconds = 0;
    if (atEdge && remaining === 0 && room > 0)
      next.cue = "Release to expand further";
  }
  const value =
    next.domain[0] +
    Math.max(0, Math.min(1, ratio)) * (next.domain[1] - next.domain[0]);
  next.bounds = moveBound(next.bounds, state.part, value, min, max);
  return next;
}
