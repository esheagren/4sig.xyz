import assert from "node:assert/strict";
import test from "node:test";
import {
  fitDomain,
  initialBounds,
  resizeBounds,
  validBounds,
} from "../src/components/interval/game.js";
import { moveBound, startDrag, stepDrag } from "../src/components/interval/range-drag.js";
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
  const waiting = hold(initial(), 0.15);
  assert.deepEqual(waiting.domain, [0, 100]);
  assert.equal(waiting.cue, "Hold to expand");
  const left = stepDrag(waiting, 0.8, 0.01, true);
  assert.equal(left.cue, "");
  assert.deepEqual(hold(left, 0.15).domain, [0, 100]);
  assert.ok(hold(left, 0.5).domain[1] > 115);
  assert.equal(hold(left, 0.5).cue, "Expanding range");
});

test("expansion is prompt and linear, and keeps going beyond the old per-drag stop", () => {
  const first = hold(initial(), 0.68);
  const second = hold(first, 1);
  assert.ok(Math.abs(first.domain[1] - 130) < 1e-8);
  assert.ok(Math.abs(second.domain[1] - 190) < 1e-8);
  const continued = hold(second, 10);
  assert.ok(Math.abs(continued.domain[1] - 790) < 1e-8);
  assert.equal(continued.cue, "Expanding range");
  assert.equal(continued.bounds.lower, 20);
  assert.equal(continued.bounds.estimate, 50);
  const returned = hold(continued, 5, 0.8);
  assert.deepEqual(returned.domain, continued.domain);
  assert.equal(returned.edge, null);
  assert.ok(hold(returned, 1).domain[1] > continued.domain[1]);
});

test("both edge zones are easy to reach and stay aligned with the widening scale", () => {
  const upper = hold(initial(), 0.5, 0.96);
  assert.equal(upper.edge, 'upper');
  assert.ok(upper.bounds.upper > 115);
  assert.ok(Math.abs(upper.bounds.upper - upper.domain[1]) < 1e-8);
  assert.deepEqual(hold(initial(), 5, 0.94).domain, [0, 100]);
  const lower = hold(startDrag({lower: 80, estimate: 100, upper: 120}, [50,150], 'lower'), .5, .04);
  assert.equal(lower.edge, 'lower');
  assert.ok(lower.bounds.lower < 35);
  assert.ok(Math.abs(lower.bounds.lower - lower.domain[0]) < 1e-8);
  assert.equal(lower.bounds.upper, 120);
});

test("expansion has the same speed at different display refresh rates", () => {
  const values = [30,60,120].map(fps => {
    let state = initial();
    for (let i=0; i<fps*3; i++) state = stepDrag(state, 1, 1/fps, true);
    return state.domain[1];
  });
  assert.ok(Math.max(...values) - Math.min(...values) < 1e-8);
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
  assert.equal(atZero.cue, 'Minimum reached');
  assert.equal(atZero.edge, null);
  const atMax = hold(initial(), 20, 100, true, 0, 150);
  assert.equal(atMax.domain[1], 150);
  assert.equal(atMax.bounds.upper, 150);
  assert.equal(atMax.cue, 'Maximum reached');
  assert.equal(atMax.edge, null);
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
      (after.domain[1] - after.domain[0]) / state.initialSpan <= 19.000001,
    );
    assert.deepEqual(stepDrag(state, 1, 1000, true).domain, domain);
  }
});

test("handles stop at the fixed estimate without rounding its precision", () => {
  const exact = 12.34567890123;
  const upper = stepDrag(
    startDrag({ lower: 5, estimate: exact, upper: 18 }, [0, 20], "upper"),
    0,
    0,
    true,
  );
  const lower = stepDrag(
    startDrag({ lower: 5, estimate: exact, upper: 18 }, [0, 20], "lower"),
    1,
    0,
    true,
  );
  assert.equal(upper.bounds.upper, exact);
  assert.equal(lower.bounds.lower, exact);
  assert.ok(validBounds(upper.bounds, 1e100, 0));
  assert.ok(validBounds(lower.bounds, 1e100, 0));
});


test("both handles close exactly onto the estimate and can reopen independently", () => {
  for (const estimate of [0, 1e-100, 12.34567890123, 1440, 1e99]) {
    let b = initialBounds(estimate, 1e100, 0);
    const domain = fitDomain(b, 1e100, 0);
    b = stepDrag(startDrag(b, domain, "lower"), 1, 0, true).bounds;
    b = stepDrag(startDrag(b, domain, "upper"), 0, 0, true).bounds;
    assert.deepEqual(b, { lower: estimate, estimate, upper: estimate });
    const opened = stepDrag(startDrag(b, domain, "upper"), 1, 0, true).bounds;
    assert.ok(opened.upper > estimate);
    assert.equal(opened.lower, estimate);
    assert.equal(opened.estimate, estimate);
    if (estimate > 0) {
      const lower = stepDrag(startDrag(b, domain, "lower"), 0, 0, true).bounds;
      assert.ok(lower.lower < estimate);
      assert.equal(lower.estimate, estimate);
    }
  }
});

test("keyboard-sized moves clamp at the estimate and never push it", () => {
  const b = { lower: 20, estimate: 50, upper: 80 };
  assert.deepEqual(moveBound(b, "lower", 100), { ...b, lower: 50 });
  assert.deepEqual(moveBound(b, "upper", 0), { ...b, upper: 50 });
  assert.deepEqual(moveBound(b, "lower", -5), { ...b, lower: 0 });
});
