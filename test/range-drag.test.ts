import assert from "node:assert/strict";
import test from "node:test";
import {
  fitDomain,
  initialBounds,
  resizeBounds,
  validBounds,
} from "../src/components/interval/game.js";
import { startDrag, stepDrag } from "../src/components/interval/range-drag.js";
import type { DragState } from "../src/components/interval/range-drag.js";

function hold(
  state: DragState,
  seconds: number,
  ratio = 1,
  moved = true,
  min = 0,
  max = 1e100,
) {
  for (let i = 0; i < Math.round(seconds * 100); i++)
    state = stepDrag(state, ratio, 0.01, moved, min, max);
  return state;
}
const initial = () =>
  startDrag({ lower: 20, estimate: 50, upper: 80 }, [0, 100], "upper");

test("ordinary dragging keeps the ruler steady and pointer overshoot cannot create huge numbers", () => {
  const inside = hold(initial(), 20, 0.7);
  assert.deepEqual(inside.domain, [0, 100]);
  assert.equal(inside.bounds.upper, 70);
  const outside = stepDrag(initial(), 1e12, 0, true);
  assert.equal(outside.bounds.upper, 100);
  assert.deepEqual(outside.domain, [0, 100]);
});

test("edge expansion requires movement and a sustained hold; leaving resets the delay", () => {
  assert.deepEqual(hold(initial(), 60, 1, false).domain, [0, 100]);
  const waiting = hold(initial(), 0.7);
  assert.deepEqual(waiting.domain, [0, 100]);
  assert.equal(waiting.cue, "Hold to expand");
  const left = stepDrag(waiting, 0.8, 0.01, true);
  assert.equal(left.cue, "");
  assert.deepEqual(hold(left, 0.7).domain, [0, 100]);
  assert.ok(hold(left, 1).domain[1] > 100);
});

test("expansion is linear, capped at twice the original span even after a long hold", () => {
  const first = hold(initial(), 1.75);
  const second = hold(first, 1);
  assert.ok(Math.abs(first.domain[1] - 112) < 1e-8);
  assert.ok(Math.abs(second.domain[1] - 124) < 1e-8);
  const capped = hold(second, 120);
  assert.ok(Math.abs(capped.domain[1] - 200) < 1e-8);
  assert.equal(capped.cue, "Release to expand further");
  assert.equal(capped.bounds.lower, 20);
  const returning = hold(stepDrag(capped, 0.8, 0, true), 5);
  assert.deepEqual(returning.domain, capped.domain);
  const released = startDrag(capped.bounds, capped.domain, "upper");
  assert.ok(hold(released, 2).domain[1] > capped.domain[1]);
});

test("zero floor and maximum apply during drag, fitting, widening, and reset", () => {
  const lower = startDrag(
    { lower: 50, estimate: 75, upper: 100 },
    [40, 120],
    "lower",
  );

  const atZero = hold(lower, 20, -100);
  assert.equal(atZero.domain[0], 0);
  assert.equal(atZero.bounds.lower, 0);
  assert.equal(atZero.bounds.upper, 100);
  const atMax = hold(initial(), 20, 100, true, 0, 150);
  assert.equal(atMax.domain[1], 150);
  assert.equal(atMax.bounds.upper, 150);
  const reset = initialBounds(50, 1e100, 0);
  assert.deepEqual(reset, { lower: 25, estimate: 50, upper: 75 });
  for (const estimate of [0, 1e-100, 1, 1e30, 1e100]) {
    const bounds = initialBounds(estimate, 1e100, 0);
    const wide = resizeBounds(bounds, 100, 1e100, 0);
    assert.ok(validBounds(wide, 1e100, 0));
    const domain = fitDomain(wide, 1e100, 0);
    assert.ok(domain[0] >= 0 && domain[1] <= 1e100);
    assert.ok(domain[0] <= wide.lower && domain[1] >= wide.upper);
  }
});

test("dragging remains finite at very small and large scales, and long frames cannot jump", () => {
  for (const estimate of [1e-100, 1e-20, 1e20, 1e99]) {
    const bounds = initialBounds(estimate, 1e100, 0);
    const domain = fitDomain(bounds, 1e100, 0);
    const state = startDrag(bounds, domain, "upper");
    const after = hold(state, 30);
    assert.ok(validBounds(after.bounds, 1e100, 0));
    assert.ok(
      (after.domain[1] - after.domain[0]) / state.initialSpan < 2.000001,
    );
    assert.deepEqual(stepDrag(state, 1, 1000, true).domain, domain);
  }
});

test("handles cannot cross even when a typed bound has more precision than the ruler", () => {
  const exact = 12.34567890123;
  const upper = stepDrag(
    startDrag({ lower: exact, estimate: 15, upper: 18 }, [0, 20], "upper"),
    0,
    0,
    true,
  );
  const lower = stepDrag(
    startDrag({ lower: 5, estimate: 10, upper: exact }, [0, 20], "lower"),
    1,
    0,
    true,
  );
  assert.equal(upper.bounds.upper, exact);
  assert.equal(lower.bounds.lower, exact);
  assert.ok(validBounds(upper.bounds, 1e100, 0));
  assert.ok(validBounds(lower.bounds, 1e100, 0));
});
