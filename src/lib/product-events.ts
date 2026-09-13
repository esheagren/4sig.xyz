import { useEffect } from "react";
import { getDeviceId } from "./device";
type Event = {
  id: string;
  name: string;
  screen?: string;
  properties: Record<string, unknown>;
};
let queue: Event[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let installed = false;
let currentVisit = "";
const disabled = () => /^\/(admin|designspace)(\/|$)/.test(location.pathname);
function visit() {
  const now = Date.now();
  try {
    const previous = JSON.parse(
      sessionStorage.getItem("four_sigma_visit") ?? "null",
    );
    const id =
      previous && now - previous.at < 1800000
        ? previous.id
        : crypto.randomUUID();
    sessionStorage.setItem("four_sigma_visit", JSON.stringify({ id, at: now }));
    return id as string;
  } catch {
    return currentVisit || crypto.randomUUID();
  }
}
function flush(beacon = false) {
  if (timer) clearTimeout(timer);
  timer = undefined;
  if (!queue.length) return;
  try {
    const events = queue.splice(0, 20);
    const body = JSON.stringify({
      visitorId: getDeviceId().replace(/^device_/, ""),
      visitId: currentVisit,
      referrer: document.referrer,
      events,
    });
    if (
      !beacon ||
      !navigator.sendBeacon(
        "/api/events",
        new Blob([body], { type: "application/json" }),
      )
    )
      void fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
  } catch {
    queue = [];
  }
}
export function trackProductEvent(
  name: string,
  properties: Record<string, unknown> = {},
  screen?: string,
) {
  if (disabled()) return;
  try {
    const next = visit();
    if (currentVisit && next !== currentVisit) flush();
    currentVisit = next;
    queue.push({ id: crypto.randomUUID(), name, properties, screen });
    if (queue.length >= 20) flush();
    else if (!timer) timer = setTimeout(() => flush(), 1000);
    if (!installed) {
      installed = true;
      window.addEventListener("pagehide", () =>
        queueMicrotask(() => flush(true)),
      );
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) queueMicrotask(() => flush(true));
      });
    }
  } catch {
    /* Analytics must never interrupt play. */
  }
}
export function useScreenTracking(
  screen: string | null,
  sessionId: string,
  questionId: string,
  position: number,
) {
  useEffect(() => {
    if (!screen || disabled()) return;
    const properties = { sessionId, questionId, position };
    trackProductEvent("screen_view", properties, screen);
    let started = document.hidden ? 0 : performance.now();
    const stop = () => {
      if (started) {
        trackProductEvent(
          "screen_exit",
          { ...properties, activeMs: performance.now() - started },
          screen,
        );
        started = 0;
      }
    };
    const visibility = () => {
      if (document.hidden) stop();
      else started = performance.now();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", stop);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", stop);
    };
  }, [screen, sessionId, questionId, position]);
}
