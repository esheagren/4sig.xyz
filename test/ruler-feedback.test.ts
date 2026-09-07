import assert from "node:assert/strict";
import test from "node:test";
import {
  RulerFeedback,
  RulerTickGate,
} from "../src/components/interval/ruler-feedback.js";

test("ticks distinguish minor and major markings in both directions without snapping", () => {
  const gate = new RulerTickGate();
  gate.begin(9, [0, 150]);
  assert.equal(gate.sample(11, [0, 150], 100), "minor");
  gate.begin(49, [0, 150]);
  assert.equal(gate.sample(51, [0, 150], 200), "major");
  gate.begin(51, [0, 150]);
  assert.equal(gate.sample(49, [0, 150], 300), "major");
  assert.equal(gate.sample(9, [0, 150], 400), "minor");
});

test("stationary handles, jitter, and rescaling do not produce repeated ticks", () => {
  const gate = new RulerTickGate();
  gate.begin(9.9, [0, 150]);
  assert.equal(gate.sample(10.1, [0, 150], 100), "minor");
  assert.equal(gate.sample(9.9, [0, 150], 200), null);
  assert.equal(gate.sample(10.1, [0, 150], 300), null);
  assert.equal(gate.sample(10.1, [0, 150], 400), null);
  assert.equal(gate.sample(50, [0, 400], 500), null);
  assert.equal(gate.sample(50, [0, 400], 600), null);
});

test("fast movement drops excess ticks, never queues a burst after stopping", () => {
  const gate = new RulerTickGate();
  gate.begin(9, [0, 150]);
  assert.equal(gate.sample(11, [0, 150], 100), "minor");
  assert.equal(gate.sample(90, [0, 150], 120), null);
  assert.equal(gate.sample(90, [0, 150], 250), null);
  assert.equal(gate.sample(149, [0, 150], 300), "major");
});

test("feedback stays optional, generates short quiet audio, and stops sound and vibration", () => {
  const names = ["document", "navigator", "AudioContext"] as const;
  const originals = names.map((name) =>
    Object.getOwnPropertyDescriptor(globalThis, name),
  );
  const pulses: number[] = [];
  const samples: Float32Array[] = [];
  let contexts = 0,
    started = 0,
    stopped = 0,
    closed = 0;
  const doc = { hidden: false };
  class FakeAudioContext {
    state = "running";
    sampleRate = 48000;
    destination = {};
    constructor() {
      contexts++;
    }
    createBuffer(_channels: number, length: number) {
      const data = new Float32Array(length);
      samples.push(data);
      return { getChannelData: () => data };
    }
    createBufferSource() {
      return {
        buffer: null,
        onended: null,
        connect() {},
        disconnect() {},
        start() {
          started++;
        },
        stop() {
          stopped++;
        },
      };
    }
    close() {
      this.state = "closed";
      closed++;
      return Promise.resolve();
    }
  }
  try {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: doc,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        vibrate: (duration: number) => {
          pulses.push(duration);
          return true;
        },
      },
    });
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
    const feedback = new RulerFeedback();
    feedback.unlock();
    feedback.play("major", true);
    assert.equal(contexts, 0);
    assert.deepEqual(pulses, []);
    feedback.enabled = true;
    feedback.unlock();
    feedback.play("minor", false);
    feedback.play("major", true);
    assert.equal(contexts, 1);
    assert.equal(started, 2);
    assert.deepEqual(pulses, [8]);
    for (const data of samples) {
      assert.equal(data.length, 864);
      assert.ok(data.every((n) => Number.isFinite(n) && Math.abs(n) <= 0.025));
      assert.ok(data.some((n) => Math.abs(n) > 0.001));
    }
    feedback.stop();
    assert.equal(stopped, 2);
    assert.deepEqual(pulses, [8, 0]);
    doc.hidden = true;
    feedback.play("major", true);
    assert.equal(started, 2);
    doc.hidden = false;
    feedback.enabled = false;
    feedback.play("major", true);
    assert.equal(started, 2);
    feedback.dispose();
    assert.equal(closed, 1);
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });
    const unsupported = new RulerFeedback();
    unsupported.enabled = true;
    assert.doesNotThrow(() => {
      unsupported.unlock();
      unsupported.play("minor", true);
      unsupported.dispose();
    });
  } finally {
    names.forEach((name, i) => {
      const descriptor = originals[i];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
});
