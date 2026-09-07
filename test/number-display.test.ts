import assert from "node:assert/strict";
import test from "node:test";
import {
  compact,
  format,
  initialBounds,
  quantity,
} from "../src/components/interval/game.js";
import { startDrag, stepDrag } from "../src/components/interval/range-drag.js";

test("readings and answers show one decimal place without rounding away whole digits", () => {
  for (const display of [compact, format]) {
    assert.equal(display(48.04), "48.0");
    assert.equal(display(48.16), "48.2");
    assert.equal(display(48), "48");
    assert.equal(display(0), "0");
  }
  assert.equal(compact(48040), "48.0K");
  assert.equal(compact(4600), "4.6K");
  assert.equal(quantity(48040000, "people"), "48.0 million people");
  assert.equal(quantity(400000, "people"), "400 thousand people");
  assert.equal(quantity(-196, "°C"), "-196 °C");
});

test("small and large values retain their scale with one decimal in scientific notation", () => {
  assert.equal(compact(1.234e20), "1.2E20");
  assert.equal(compact(0.004804), "4.8E-3");
  assert.equal(format(0.004804), "4.8E-3");
});

test("formatting leaves precise bounds and smooth dragging intact", () => {
  assert.deepEqual(initialBounds(50, 1e100, 0), {
    lower: 25,
    estimate: 50,
    upper: 75,
  });
  const state = stepDrag(
    startDrag({ lower: 20, estimate: 40, upper: 80 }, [0, 100], "upper"),
    0.4804,
    0,
    true,
  );
  assert.equal(state.bounds.upper, 48.04);
  assert.equal(compact(state.bounds.upper), "48.0");
  assert.equal(state.bounds.upper, 48.04);
});
