import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
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
  children,
}: {
  icon: PlayerIcon;
  color: string;
  onChange: (icon: PlayerIcon, color: string) => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const [paused, setPaused] = useState(false);
  const [open, setOpen] = useState<"pattern" | "color" | null>(null);
  const id = useId();
  const patternButton = useRef<HTMLButtonElement>(null);
  const colorButton = useRef<HTMLButtonElement>(null);
  const compact = children !== undefined;
  function close(panel: "pattern" | "color") {
    if (!compact) return;
    setOpen(null);
    (panel === "pattern" ? patternButton : colorButton).current?.focus();
  }
  return (
    <div
      className={`personality-picker ${compact ? "compact-personality" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          close(open);
        }
      }}
    >
      {compact && (
        <div className="identity-controls">
          {children}
          <button
            ref={patternButton}
            type="button"
            className="identity-pattern-button"
            disabled={disabled}
            aria-expanded={open === "pattern"}
            aria-controls={`${id}-patterns`}
            aria-label={`Change pattern: ${playerIcons.find((p) => p.id === icon)!.label}`}
            title="Change pattern"
            onClick={() => setOpen(open === "pattern" ? null : "pattern")}
          >
            <PlayerMark icon={icon} color={color} paused={paused} />
            <span aria-hidden="true">⌄</span>
          </button>
          <button
            ref={colorButton}
            type="button"
            className="identity-color-button"
            disabled={disabled}
            aria-expanded={open === "color"}
            aria-controls={`${id}-colors`}
            aria-label={`Change color: ${colorName(color)}`}
            title="Change color"
            onClick={() => setOpen(open === "color" ? null : "color")}
          >
            <span
              className="identity-color-dot"
              style={{ background: color }}
            />
            <span aria-hidden="true">⌄</span>
          </button>
        </div>
      )}
      <div
        id={`${id}-patterns`}
        className="identity-options-panel"
        hidden={compact && open !== "pattern"}
      >
        <fieldset className="motion-picker" disabled={disabled}>
          <legend>Your pattern</legend>
          <div className="motion-options">
            {playerIcons.map((item) => (
              <label key={item.id}>
                <input
                  type="radio"
                  name={`${id}-pattern`}
                  checked={icon === item.id}
                  onChange={() => {
                    onChange(item.id, color);
                    close("pattern");
                  }}
                  onClick={() => {
                    if (icon === item.id) close("pattern");
                  }}
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
      </div>
      <div
        id={`${id}-colors`}
        className="identity-options-panel"
        hidden={compact && open !== "color"}
      >
        <fieldset className="color-picker" disabled={disabled}>
          <legend>
            Your color <span>{colorName(color)}</span>
          </legend>
          <div>
            {playerColors.map((c) => (
              <label key={c.value} title={c.label}>
                <input
                  type="radio"
                  name={`${id}-color`}
                  checked={color === c.value}
                  onChange={() => {
                    onChange(icon, c.value);
                    close("color");
                  }}
                  onClick={() => {
                    if (color === c.value) close("color");
                  }}
                  aria-label={c.label}
                />
                <span style={{ background: c.value }}>
                  <span aria-hidden="true">{color === c.value ? "✓" : ""}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}

function identityDraft(initial: Partial<Player>): Player {
  try {
    const stored = JSON.parse(sessionStorage.getItem('four_sigma_identity_draft') ?? 'null');
    if (stored && !initial.icon) return { username: initial.username ?? stored.username ?? '', icon: normalizeIcon(stored.icon), color: normalizeColor(stored.color) };
  } catch { /* Storage is optional. */ }
  return { username: initial.username ?? '',
    icon: initial.icon ?? playerIcons[Math.floor(Math.random() * playerIcons.length)].id,
    color: initial.color ?? playerColors[Math.floor(Math.random() * playerColors.length)].value };
}

export function PlayerIdentity({
  initial,
  onStart,
  onboarding = false,
}: {
  initial: Partial<Player>;
  onboarding?: boolean;
  onStart: (player: Player) => Promise<void>;
}) {
  const [draft] = useState(() => identityDraft(initial));
  const [username, setUsername] = useState(draft.username),
    [icon, setIcon] = useState<PlayerIcon>(draft.icon),
    [color, setColor] = useState(draft.color);
  const [availability, setAvailability] = useState<{ name: string; state: 'checking' | 'available' | 'taken' | 'error' }>({name: '', state: 'checking'});
  useEffect(() => {
    try { sessionStorage.setItem('four_sigma_identity_draft', JSON.stringify({ username, icon, color })); } catch { /* Optional. */ }
  }, [username, icon, color]);
  useEffect(() => {
    const name = username.trim();
    if (initial.username || !validUsername(name)) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setAvailability({ name, state: 'checking' });
      void fetch('/api/auth/check-username', { method: 'POST', signal: abort.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: name }) })
        .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(data => setAvailability({ name, state: data.available ? 'available' : 'taken' }))
        .catch(() => { if (!abort.signal.aborted) setAvailability({ name, state: 'error' }); });
    }, 350);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [username, initial.username]);
  const checked = availability.name === username.trim() ? availability.state : 'checking';
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
        <div>
          <h1>
            Make it <em>yours.</em>
          </h1>
          <p className="identity-ritual">{onboarding ? 'Your starting calibration is complete. Choose how you will appear on your scorecard.' : 'Give your score a signature.'}</p>
        </div>
      </div>
      <form onSubmit={start}>
        <label className="identity-label" htmlFor="player-name">
          Username
        </label>
        <PersonalityPicker
          icon={icon}
          color={color}
          disabled={pending}
          onChange={(i, c) => {
            setIcon(i);
            setColor(c);
          }}
        >
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
              initial.username
                ? "identity-error"
                : "username-help identity-error"
            }
            placeholder="Your name"
            disabled={pending}
            readOnly={!!initial.username}
          />
        </PersonalityPicker>
        {!initial.username && (
          <p id="username-help" className="identity-help">
            3–20 letters, numbers or underscores.
          </p>
        )}
        {!initial.username && validUsername(username.trim()) && <p className={
          'username-availability ' + checked} role="status">{checked === 'available' ? 'Username available' : checked === 'taken' ? 'That username is already taken.' : checked === 'error' ? 'Availability check unavailable. Submit to try again.' : 'Checking availability...'}</p>}
        <p id="identity-error" className="identity-error" role="status">
          {error}
        </p>
        <button
          type="submit"
          className="primary"
          disabled={pending || !validUsername(username.trim()) || (!initial.username && checked === 'taken')}
        >
          {pending ? "Saving…" : "See my results"}
          <span aria-hidden="true">→</span>
        </button>
      </form>
    </section>
  );
}
