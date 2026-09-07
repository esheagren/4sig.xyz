import type { Bounds } from "./game";

// Keep playable bounds on one significant digit, including at domain edges.
function directed(value: number, direction: "floor" | "ceil") {
  if (value === 0) return 0;
  const step = 10 ** Math.floor(Math.log10(Math.abs(value)));
  return Number(
    (
      Math[direction](Number((value / step).toPrecision(12))) * step
    ).toPrecision(1),
  );
}

export function roundBounds(b: Bounds, min = 0, max = 1e100): Bounds {
  const low = directed(min, "ceil"),
    high = directed(max, "floor");
  const round = (value: number) =>
    Math.max(low, Math.min(high, Number(value.toPrecision(1))));
  const lower = round(b.lower),
    upper = round(b.upper);
  return {
    lower,
    upper,
    estimate: Math.max(lower, Math.min(upper, b.estimate)),
  };
}

export function nextBound(value: number, direction: 1 | -1, span: number) {
  if (value === 0) return direction * 10 ** Math.floor(Math.log10(span / 100));
  let step = 10 ** Math.floor(Math.log10(Math.abs(value)));
  if (direction === -1 && value === step) step /= 10;
  return Number((value + direction * step).toPrecision(1));
}
