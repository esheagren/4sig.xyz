import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";
const html = readFileSync(
  new URL("../api/_lib/designspace-archive.html", import.meta.url),
  "utf8",
);
class Events {
  listeners = new Map();
  addEventListener(name, fn) {
    const list = this.listeners.get(name) || [];
    list.push(fn);
    this.listeners.set(name, list);
  }
  emit(name, fields = {}) {
    const e = { preventDefault() {}, ...fields };
    for (const fn of this.listeners.get(name) || []) fn(e);
  }
}
const functionSource = html.match(
  /function installHoldControls[\s\S]*?\n\/\/ End hold controls\./,
)[0];
function harness() {
  const root = new Events(),
    window = new Events(),
    document = Object.assign(new Events(), { hidden: false });
  let now = 0,
    sequence = 0,
    commits = 0;
  const frames = new Map(),
    timers = new Map();
  const classes = new Set(),
    style = new Map();
  const button = {
    disabled: false,
    isConnected: true,
    style: { setProperty: (k, v) => style.set(k, v) },
    classList: {
      add: (...v) => v.forEach((x) => classes.add(x)),
      remove: (...v) => v.forEach((x) => classes.delete(x)),
    },
    focus() {},
    capture: null,
    setPointerCapture(id) {
      this.capture = id;
    },
    hasPointerCapture(id) {
      return this.capture === id;
    },
    releasePointerCapture() {
      this.capture = null;
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 80, height: 80 };
    },
    closest(selector) {
      return selector === ".hold-commit" ? this : null;
    },
  };
  const ctx = vm.createContext({
    window,
    document,
    performance: { now: () => now },
    requestAnimationFrame(fn) {
      frames.set(++sequence, fn);
      return sequence;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    setTimeout(fn, delay) {
      timers.set(++sequence, { fn, at: now + delay });
      return sequence;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  });
  vm.runInContext(
    functionSource + "\n;globalThis.install=installHoldControls;",
    ctx,
  );
  const cancel = ctx.install(root, () => commits++);
  const emit = (name, fields = {}) =>
    root.emit(name, {
      target: button,
      isPrimary: true,
      button: 0,
      pointerId: 1,
      clientX: 40,
      clientY: 40,
      ...fields,
    });
  const at = (time) => {
    now = time;
    const run = [...frames.values()];
    frames.clear();
    run.forEach((fn) => fn(now));
    for (const [id, t] of timers) {
      if (t.at <= now) {
        timers.delete(id);
        t.fn();
      }
    }
  };
  return {
    emit,
    at,
    cancel,
    window,
    document,
    button,
    classes,
    style,
    get commits() {
      return commits;
    },
  };
}
test("hold confirmation supports cancellation, keyboard, and exactly-once commitment", () => {
  let h = harness();
  h.emit("pointerdown");
  h.at(250);
  assert.equal(h.style.get("--hold"), "0.5");
  h.emit("pointerup");
  h.at(800);
  assert.equal(h.commits, 0);
  assert.equal(h.style.get("--hold"), "0");
  h = harness();
  h.emit("pointerdown");
  h.at(499);
  assert.equal(h.commits, 0);
  h.at(500);
  assert.ok(h.classes.has("committed"));
  h.emit("pointerup");
  h.at(620);
  assert.equal(h.commits, 1);
  h.at(1000);
  assert.equal(h.commits, 1);
  for (const event of [
    "pointercancel",
    "lostpointercapture",
    "focusout",
    "input",
  ]) {
    h = harness();
    h.emit("pointerdown");
    h.at(250);
    h.emit(event);
    h.at(900);
    assert.equal(h.commits, 0, event);
  }
  h = harness();
  h.emit("pointerdown");
  h.at(250);
  h.emit("pointermove", { clientX: 200 });
  h.at(900);
  assert.equal(h.commits, 0);
  h = harness();
  h.emit("pointerdown");
  h.at(250);
  h.window.emit("blur");
  h.at(900);
  assert.equal(h.commits, 0);
  h = harness();
  h.emit("pointerdown");
  h.at(250);
  h.document.hidden = true;
  h.document.emit("visibilitychange");
  h.at(900);
  assert.equal(h.commits, 0);
  for (const key of [" ", "Enter"]) {
    h = harness();
    h.emit("keydown", { key });
    h.at(250);
    h.emit("keydown", { key, repeat: true });
    h.at(500);
    h.emit("keyup", { key });
    h.at(620);
    assert.equal(h.commits, 1);
  }
  h = harness();
  h.emit("keydown", { key: " " });
  h.at(250);
  h.emit("keyup", { key: " " });
  h.at(900);
  assert.equal(h.commits, 0);
  h = harness();
  h.emit("click");
  h.at(900);
  assert.equal(h.commits, 0);
  h = harness();
  h.emit("pointerdown");
  h.at(500);
  h.cancel();
  h.at(900);
  assert.equal(h.commits, 0);
  console.log(
    "Hold tests passed: 500ms commitment, progress, early release, pointer exit/cancel, focus/visibility loss, keyboard, no click bypass, and cancellation on changing studies.",
  );
});
