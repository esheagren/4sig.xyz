import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  playerIcons,
  playerColors,
  validUsername,
  normalizeColor,
  normalizeIcon,
  colorName,
  DEFAULT_COLOR,
} from "./player";
import type { Player, PlayerIcon } from "./player";
import { patternFrame } from "./patterns";

export function PlayerMark({
  icon,
  color = DEFAULT_COLOR,
  paused = false,
}: {
  icon: PlayerIcon;
  color?: string;
  paused?: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const safeColor = normalizeColor(color);
  const rgb = [1, 3, 5].map(
    (i) => parseInt(safeColor.slice(i, i + 2), 16) / 255,
  );
  const light = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.68;
  useEffect(() => {
    const node = svg.current;
    if (!node) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      last = 0,
      start = performance.now(),
      visible = true;
    const tick = (now: number) => {
      if (now - last > 32) {
        node.innerHTML = patternFrame(icon, (now - start) / 8000);
        last = now;
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      if (!paused && !motion.matches && !document.hidden && visible) {
        start = performance.now();
        frame = requestAnimationFrame(tick);
      } else node.innerHTML = patternFrame(icon, 0.125);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(node);
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [icon, paused]);
  return (
    <svg
      ref={svg}
      className="player-mark mathematical-mark"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.15"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        color: safeColor,
        background: light ? "#352a25" : undefined,
        borderRadius: light ? 8 : undefined,
      }}
      dangerouslySetInnerHTML={{ __html: patternFrame(icon, 0.125) }}
    />
  );
}

export function PersonalityPicker({
  icon,
  color,
  onChange,
  disabled = false,
}: {
  icon: PlayerIcon;
  color: string;
  onChange: (icon: PlayerIcon, color: string) => void;
  disabled?: boolean;
}) {
  const [paused, setPaused] = useState(false);
  return (
    <div className="personality-picker">
      <fieldset className="motion-picker" disabled={disabled}>
        <legend>Your pattern</legend>
        <div className="motion-options">
          {playerIcons.map((item) => (
            <label key={item.id}>
              <input
                type="radio"
                name="player-pattern"
                checked={icon === item.id}
                onChange={() => onChange(item.id, color)}
              />
              <span>
                <PlayerMark icon={item.id} color={color} paused={paused} />
                <strong>{item.label}</strong>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="pattern-caption">
        <p>{playerIcons.find((p) => p.id === icon)!.description}</p>
        <button
          className="text-button"
          type="button"
          onClick={() => setPaused(!paused)}
          aria-pressed={paused}
        >
          {paused ? "Play motion" : "Pause motion"}
        </button>
      </div>
      <fieldset className="color-picker" disabled={disabled}>
        <legend>
          Your color <span>{colorName(color)}</span>
        </legend>
        <div>
          {playerColors.map((c) => (
            <label key={c.value} title={c.label}>
              <input
                type="radio"
                name="player-color"
                checked={color === c.value}
                onChange={() => onChange(icon, c.value)}
                aria-label={c.label}
              />
              <span style={{ background: c.value }}>
                <span aria-hidden="true">{color === c.value ? "✓" : ""}</span>
              </span>
            </label>
          ))}
          <label className="custom-color" title="Choose your own color">
            <input
              type="color"
              value={color}
              aria-label="Choose your own color"
              onChange={(e) => onChange(icon, e.target.value)}
            />
            <span aria-hidden="true">+</span>
          </label>
        </div>
      </fieldset>
    </div>
  );
}

export function PlayerIdentity({
  initial,
  onStart,
}: {
  initial: Partial<Player>;
  onStart: (player: Player) => Promise<void>;
}) {
  const [username, setUsername] = useState(initial.username ?? ""),
    [icon, setIcon] = useState<PlayerIcon>(normalizeIcon(initial.icon)),
    [color, setColor] = useState(normalizeColor(initial.color));
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  async function start(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const name = username.trim();
    if (!validUsername(name)) {
      setError("Use 3–20 letters, numbers or underscores.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await onStart({ username: name, icon, color });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start. Try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="identity-screen">
      <div className="identity-intro">
        <div className="identity-preview">
          <PlayerMark icon={icon} color={color} paused />
        </div>
        <div>
          <h1>
            Make it
            <br />
            <em>yours.</em>
          </h1>
          <p className="identity-ritual">Give your score a signature.</p>
        </div>
      </div>
      <form onSubmit={start}>
        <label className="identity-label" htmlFor="player-name">
          Username
        </label>
        <input
          id="player-name"
          name="username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setError("");
          }}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          minLength={3}
          maxLength={20}
          pattern="[a-zA-Z0-9_]{3,20}"
          aria-describedby={
            initial.username ? "identity-error" : "username-help identity-error"
          }
          placeholder="Your name"
          disabled={pending}
          readOnly={!!initial.username}
        />
        {!initial.username && (
          <p id="username-help" className="identity-help">
            3–20 letters, numbers or underscores.
          </p>
        )}
        <PersonalityPicker
          icon={icon}
          color={color}
          disabled={pending}
          onChange={(i, c) => {
            setIcon(i);
            setColor(c);
          }}
        />
        <p id="identity-error" className="identity-error" role="status">
          {error}
        </p>
        <button
          type="submit"
          className="primary"
          disabled={pending || !validUsername(username.trim())}
        >
          {pending ? "Saving…" : "See my score"}
          <span aria-hidden="true">→</span>
        </button>
      </form>
    </section>
  );
}
