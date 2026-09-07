import { MINOR_DIVISIONS, rulerScale } from "./ruler-scale";
export type TickKind = "minor" | "major";
export const FEEDBACK_KEY = "four_sigma_ruler_feedback";

// Use the same round-number markings as the visible ruler; never queue ticks.
export class RulerTickGate {
  private position = 0;
  private domain: [number, number] = [0, 1];
  private lastTime = -Infinity;
  private lastMark: number | null = null;

  begin(value: number, domain: [number, number]) {
    this.domain = [...domain];
    this.position = this.locate(value, domain);
    this.lastMark = null;
  }

  private locate(value: number, domain: [number, number]) {
    const { minorStep } = rulerScale(domain);
    return Math.max(domain[0], Math.min(domain[1], value)) / minorStep;
  }

  sample(
    value: number,
    domain: [number, number],
    now: number,
  ): TickKind | null {
    if (domain[0] !== this.domain[0] || domain[1] !== this.domain[1]) {
      this.begin(value, domain);
      return null; // Rescaling alone must not make noise.
    }
    const position = this.locate(value, domain),
      previous = this.position;
    this.position = position;
    if (!Number.isFinite(position) || position === previous) return null;
    if (this.lastMark !== null && Math.abs(previous - this.lastMark) > 0.15)
      this.lastMark = null;
    const forward = position > previous;
    const first = forward ? Math.floor(previous) + 1 : Math.ceil(previous) - 1;
    const last = forward ? Math.floor(position) : Math.ceil(position);
    if (forward ? first > last : first < last) return null;
    if (last === this.lastMark) return null;
    this.lastMark = last;
    if (now - this.lastTime < 75) return null;
    this.lastTime = now;
    const low = Math.min(first, last),
      high = Math.max(first, last);
    return Math.ceil(low / MINOR_DIVISIONS) * MINOR_DIVISIONS <= high
      ? "major"
      : "minor";
  }
}

export class RulerFeedback {
  enabled = false;
  private context: AudioContext | null = null;
  private buffers: Partial<Record<TickKind, AudioBuffer>> = {};
  private sources = new Set<AudioBufferSourceNode>();
  private vibrating = false;

  // Call only from a tap, pointer-down, or key press to unlock mobile audio.
  unlock() {
    if (!this.enabled || document.hidden) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended")
        void this.context.resume().catch(() => {});
    } catch {
      /* Unsupported or blocked audio must not affect dragging. */
    }
  }

  play(kind: TickKind, touch: boolean) {
    if (!this.enabled || document.hidden) return;
    const context = this.context;
    if (context?.state === "running") {
      try {
        let buffer = this.buffers[kind];
        if (!buffer) {
          buffer = context.createBuffer(
            1,
            Math.ceil(context.sampleRate * 0.018),
            context.sampleRate,
          );
          const data = buffer.getChannelData(0);
          const major = kind === "major";
          for (let i = 0; i < data.length; i++) {
            const t = i / context.sampleRate;
            // A gently introduced, high, clean tone instead of a noisy impact.
            const attack = 1 - Math.exp(-t / 0.0015);
            const envelope =
              attack * Math.exp(-t / 0.003) * Math.max(0, 1 - t / 0.018) ** 2;
            data[i] =
              (Math.sin(2 * Math.PI * (major ? 2800 : 3200) * t) * 0.85 +
                Math.sin(2 * Math.PI * 5200 * t) * 0.15) *
              envelope *
              (major ? 0.075 : 0.055);
          }
          this.buffers[kind] = buffer;
        }
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        this.sources.add(source);
        source.onended = () => {
          source.disconnect();
          this.sources.delete(source);
        };
        source.start();
      } catch {
        /* Audio is optional. */
      }
    }
    if (touch && typeof navigator.vibrate === "function") {
      try {
        this.vibrating = navigator.vibrate(kind === "major" ? 8 : 5);
      } catch {
        /* Vibration is optional. */
      }
    }
  }

  stop() {
    for (const source of this.sources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        /* Already ended. */
      }
    }
    this.sources.clear();
    if (this.vibrating) {
      try {
        navigator.vibrate(0);
      } catch {
        /* Device no longer available. */
      }
      this.vibrating = false;
    }
  }

  dispose() {
    this.stop();
    if (this.context && this.context.state !== "closed")
      void this.context.close().catch(() => {});
    this.context = null;
    this.buffers = {};
  }
}
