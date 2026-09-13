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
  edgeSeconds: number;
  edge: "lower" | "upper" | null;
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
    edgeSeconds: 0,
    edge: null,
    cue: "",
  };
}

const EDGE_DELAY = 0.18;
const EDGE_SPEED = 0.6;

// Speed stays relative to the pointer-down span, so a long hold never compounds.
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
    edge: null as DragState["edge"],
  };
  const upper = state.part === "upper";
  const atEdge = moved && (upper ? ratio >= 0.95 : ratio <= 0.05);
  const room = upper ? max - state.domain[1] : state.domain[0] - min;
  if (atEdge && room > 0) {
    next.edge = state.part;
    next.edgeSeconds += Math.max(0, Math.min(seconds, 0.05));
    const activeSeconds =
      Math.max(0, next.edgeSeconds - EDGE_DELAY) -
      Math.max(0, state.edgeSeconds - EDGE_DELAY);
    const expansion = Math.min(
      room,
      state.initialSpan * EDGE_SPEED * activeSeconds,
    );
    if (upper) next.domain[1] = Math.min(max, state.domain[1] + expansion);
    else next.domain[0] = Math.max(min, state.domain[0] - expansion);
    next.cue = next.edgeSeconds <= EDGE_DELAY ? "Hold to expand" : "Expanding range";
  } else {
    next.edgeSeconds = 0;
    if (atEdge) next.cue = upper ? "Maximum reached" : "Minimum reached";
  }
  const boundRatio = atEdge ? (upper ? 1 : 0) : Math.max(0, Math.min(1, ratio));
  const value =
    next.domain[0] +
    boundRatio * (next.domain[1] - next.domain[0]);
  next.bounds = moveBound(next.bounds, state.part, value, min, max);
  return next;
}
