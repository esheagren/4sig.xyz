import assert from "node:assert/strict";
import test from "node:test";
import { rulerScale } from "../src/components/interval/ruler-scale.js";
import { RulerTickGate } from "../src/components/interval/ruler-feedback.js";

test("major ticks land on round numbers rather than arbitrary viewport fractions", () => {
  assert.deepEqual(
    rulerScale([13, 107])
      .ticks.filter((t) => t.major)
      .map((t) => t.value),
    [20, 40, 60, 80, 100],
  );
  assert.deepEqual(
    rulerScale([100000, 1800000])
      .ticks.filter((t) => t.major)
      .map((t) => t.value),
    [500000, 1000000, 1500000],
  );
  assert.deepEqual(
    rulerScale([0.013, 0.107])
      .ticks.filter((t) => t.major)
      .map((t) => t.value),
    [0.02, 0.04, 0.06, 0.08, 0.1],
  );
  assert.deepEqual(
    rulerScale([14, 108])
      .ticks.filter((t) => t.major)
      .map((t) => t.value),
    [20, 40, 60, 80, 100],
  );
});

test("tick positions and sounds agree across orders of magnitude", () => {
  for (const magnitude of [1e-100, 1e-10, 1, 1e5, 1e50, 1e98]) {
    const domain: [number, number] = [0, 100 * magnitude];
    const scale = rulerScale(domain);
    assert.ok(
      scale.ticks.length <= 32 &&
        scale.ticks.filter((t) => t.major).length <= 6,
    );
    for (const tick of scale.ticks) {
      assert.ok(
        Number.isFinite(tick.value) && tick.position >= 0 && tick.position <= 1,
      );
      assert.ok(Math.abs(tick.position - tick.value / domain[1]) < 1e-10);
      if (tick.value === 0) continue;
      const gate = new RulerTickGate();
      gate.begin(tick.value - scale.minorStep * 0.1, domain);
      assert.equal(
        gate.sample(tick.value + scale.minorStep * 0.1, domain, 100),
        tick.major ? "major" : "minor",
      );
    }
  }
});
