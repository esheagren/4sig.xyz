import assert from "node:assert/strict";
import test from "node:test";
import {
  nextBound,
  roundBounds,
} from "../src/components/interval/bound-precision.js";
import {
  fitDomain,
  initialBounds,
  validBounds,
} from "../src/components/interval/game.js";
import { startDrag, stepDrag } from "../src/components/interval/range-drag.js";

test("playable bounds use one significant figure at every scale", () => {
  for (const scale of [1e-100, 1e-10, 1, 1e5, 1e95]) {
    const b = roundBounds({
      lower: 48.04 * scale,
      estimate: 60 * scale,
      upper: 76.23 * scale,
    });
    assert.equal(b.lower, Number((50 * scale).toPrecision(1)));
    assert.equal(b.upper, Number((80 * scale).toPrecision(1)));
    assert.ok(validBounds(b, 1e100, 0));
  }
  assert.deepEqual(roundBounds({ lower: 0, estimate: 0, upper: 0 }), {
    lower: 0,
    estimate: 0,
    upper: 0,
  });
});

test("dragged bounds stay representable, ordered, and inside the visible domain", () => {
  for (const estimate of [0, 1e-100, 48.04, 1e20, 1e99]) {
    const b = roundBounds(initialBounds(estimate, 1e100, 0));
    const domain = fitDomain(b, 1e100, 0);
    for (const part of ["lower", "upper"] as const) {
      for (const ratio of [0, 0.12345, 0.4804, 0.87654, 1]) {
        const dragged = stepDrag(startDrag(b, domain, part), ratio, 0, true);
        const displayed = roundBounds(dragged.bounds, domain[0], domain[1]);
        assert.ok(validBounds(displayed, domain[1], domain[0]));
        assert.equal(displayed.lower, Number(displayed.lower.toPrecision(1)));
        assert.equal(displayed.upper, Number(displayed.upper.toPrecision(1)));
      }
    }
  }
  assert.equal(
    roundBounds({ lower: 20, estimate: 70, upper: 149 }, 0, 150).upper,
    100,
  );
});

test("keyboard arrows advance one representable value including across powers of ten", () => {
  assert.equal(nextBound(50, 1, 100), 60);
  assert.equal(nextBound(50, -1, 100), 40);
  assert.equal(nextBound(90, 1, 100), 100);
  assert.equal(nextBound(100, -1, 100), 90);
  assert.equal(nextBound(0.1, -1, 1), 0.09);
  assert.equal(nextBound(0, 1, 100), 1);
});

test("exact decimal domain boundaries are not moved by floating-point division", () => {
  for (const value of [0.3, 0.6, 0.7, 3e-20, 7e20]) {
    assert.equal(
      roundBounds({ lower: 0, estimate: value, upper: value }, 0, value).upper,
      value,
    );
    assert.equal(
      roundBounds({ lower: value, estimate: value, upper: value * 10 }, value)
        .lower,
      value,
    );
  }
});
