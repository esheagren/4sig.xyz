export function attachHoldControl(
  button: HTMLButtonElement,
  commit: () => void,
) {
  const events = new AbortController();
  const options = { signal: events.signal };
  let frame = 0,
    finish = 0,
    started = 0;
  let holding = false,
    complete = false,
    pointer: number | null = null,
    key: string | null = null;
  function cancel(force = false) {
    if (complete && !force) return;
    holding = false;
    complete = false;
    cancelAnimationFrame(frame);
    clearTimeout(finish);
    button.style.setProperty("--hold", "0");
    button.classList.remove("holding", "committed");
    const captured = pointer;
    pointer = null;
    key = null;
    if (captured !== null && button.hasPointerCapture(captured))
      button.releasePointerCapture(captured);
  }
  function tick(now: number) {
    if (!holding) return;
    if (document.hidden || !button.isConnected || button.disabled) {
      cancel(true);
      return;
    }
    const progress = Math.min(1, (now - started) / 500);
    button.style.setProperty("--hold", String(progress));
    if (progress < 1) {
      frame = requestAnimationFrame(tick);
      return;
    }
    complete = true;
    button.classList.remove("holding");
    button.classList.add("committed");
    finish = window.setTimeout(() => {
      cancel(true);
      commit();
    }, 120);
  }
  function begin() {
    started = performance.now();
    holding = true;
    button.focus({ preventScroll: true });
    button.classList.add("holding");
    frame = requestAnimationFrame(tick);
  }
  button.addEventListener(
    "pointerdown",
    (e) => {
      if (!e.isPrimary || e.button !== 0 || button.disabled) return;
      e.preventDefault();
      cancel(true);
      pointer = e.pointerId;
      button.setPointerCapture(pointer);
      begin();
    },
    options,
  );
  button.addEventListener(
    "pointermove",
    (e) => {
      if (pointer !== e.pointerId) return;
      const r = button.getBoundingClientRect();
      if (
        Math.hypot(
          e.clientX - r.left - r.width / 2,
          e.clientY - r.top - r.height / 2,
        ) >
        r.width / 2 + 12
      )
        cancel();
    },
    options,
  );
  for (const type of [
    "pointerup",
    "pointercancel",
    "lostpointercapture",
  ] as const)
    button.addEventListener(
      type,
      (e) => {
        if (pointer === e.pointerId) cancel();
      },
      options,
    );
  button.addEventListener(
    "keydown",
    (e) => {
      if (![" ", "Enter"].includes(e.key) || button.disabled) return;
      e.preventDefault();
      if (!e.repeat && !holding) {
        key = e.key;
        begin();
      }
    },
    options,
  );
  button.addEventListener(
    "keyup",
    (e) => {
      if (key === e.key) {
        e.preventDefault();
        cancel();
      }
    },
    options,
  );
  button.addEventListener("click", (e) => e.preventDefault(), options);
  button.addEventListener("contextmenu", (e) => e.preventDefault(), options);
  button.addEventListener("blur", () => cancel(), options);
  window.addEventListener("blur", () => cancel(true), options);
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) cancel(true);
    },
    options,
  );
  return () => {
    cancel(true);
    events.abort();
  };
}
