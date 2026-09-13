import { inkStyles } from '../../../shared/ink-collection';
import { normalizeStyle, type PlayerStyle } from '../../../shared/player-profile';
import { memo, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  playerColors,
  validUsername,
  normalizeColor,
  colorName,
  DEFAULT_COLOR,
} from "./player";
import type { PlayerIcon } from "./player";
import { patternFrame } from "./patterns";

export const PlayerMark = memo(function PlayerMark({
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
    // The animation owns these children; form renders must not reset its frame.
    node.innerHTML = patternFrame(icon, 0.125);
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
    />
  );
});

export function PersonalityPicker({
  icon,
  color,
  onChange,
  style,
  disabled = false,
  children,
}: {
  icon: PlayerIcon;
  color: string;
  style?: PlayerStyle;
  onChange: (icon: PlayerIcon, color: string, style: PlayerStyle) => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const patternButton = useRef<HTMLButtonElement>(null);
  const compact = children !== undefined;
  function close() {
    if (!compact) return;
    setOpen(false);
    patternButton.current?.focus();
  }
  return (
    <div
      className={`personality-picker ${compact ? "compact-personality" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          close();
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
            aria-expanded={open}
            aria-controls={`${id}-patterns`}
            aria-label={`Change style and color: ${inkStyles.find((p) => p.id === normalizeStyle(style, icon))!.name}`}
            title="Change style and color"
            onClick={() => setOpen(!open)}
          >
            <PlayerMark icon={icon} color={color} />
            <span aria-hidden="true">⌄</span>
          </button>
        </div>
      )}
      <div
        id={`${id}-patterns`}
        className="identity-options-panel"
        hidden={compact && !open}
      >
        <fieldset className="motion-picker" disabled={disabled}>
          <legend>Your style</legend>
          <div className="motion-options">
            {inkStyles.map((item) => (
              <label key={item.id}>
                <input
                  type="radio"
                  name={`${id}-pattern`}
                  checked={normalizeStyle(style, icon) === item.id}
                  onChange={() => {
                    onChange(item.icon, color, item.id);
                  }}
                />
                <span>
                  <PlayerMark icon={item.icon} color={color} />
                  <strong>{item.name}</strong>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="pattern-caption">
          <p>{inkStyles.find((p) => p.id === normalizeStyle(style, icon))!.description}</p>
        </div>
        <div className="pattern-color-section">
          <fieldset className="color-picker" disabled={disabled}>
            <legend>
              Color <span>{colorName(color)}</span>
            </legend>
            <div>
              {playerColors.map((c) => (
                <label key={c.value} title={c.label}>
                  <input
                    type="radio"
                    name={`${id}-color`}
                    checked={color === c.value}
                    onChange={() => {
                      onChange(icon, c.value, normalizeStyle(style, icon));
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
    </div>
  );
}

export function PlayerIdentity({
  initialUsername = '',
  onStart,
}: {
  initialUsername?: string;
  onStart: (username: string) => Promise<void>;
}) {
  const [username, setUsername] = useState(initialUsername);
  const screen = useRef<HTMLElement>(null);
  useEffect(() => { screen.current?.focus({ preventScroll: true }); }, []);
  const [availability, setAvailability] = useState<{ name: string; state: 'checking' | 'available' | 'taken' | 'error' }>({name: '', state: 'checking'});
  useEffect(() => {
    const name = username.trim();
    if (initialUsername || !validUsername(name)) return;
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
  }, [username, initialUsername]);
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
      await onStart(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start. Try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section ref={screen} className="identity-screen claim-screen" aria-label="Claim Username" tabIndex={-1}>
      <span className="brand claim-brand" aria-label="Four Sigma">4<span>σ</span></span>
      <form onSubmit={start}>
        <label className="sr-only" htmlFor="player-name">Claim Username</label>
        <input
          id="player-name" name="username" value={username}
          onChange={e => { setUsername(e.target.value); setError(''); }}
          autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          required minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]{3,20}"
          aria-describedby="username-help identity-error" placeholder="Claim Username"
          disabled={pending} readOnly={!!initialUsername}
        />
        <div className="claim-feedback">
          <p id="username-help" className="identity-help">3–20 letters, numbers or underscores.</p>
          {!initialUsername && validUsername(username.trim()) && <p className={'username-availability ' + checked} role="status">
            {checked === 'available' ? 'Username available' : checked === 'taken' ? 'That username is already taken.' : checked === 'error' ? 'Submit to check availability.' : 'Checking availability…'}
          </p>}
          <p id="identity-error" className="identity-error" role="status">{error}</p>
        </div>
        <div className="welcome-play">
          <button type="submit" className="hold-commit welcome-play-button"
            aria-label={pending ? 'Saving username' : 'Begin'}
            disabled={pending || !validUsername(username.trim()) || (!initialUsername && checked === 'taken')}>
            <svg className="commit-ring" viewBox="0 0 80 80" aria-hidden="true"><circle className="commit-track" cx="40" cy="40" r="36" /></svg>
            <svg className="commit-arrow" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M7 16h18m-7-7 7 7-7 7" /></svg>
          </button>
          <span aria-hidden="true">{pending ? 'Saving…' : 'Begin'}</span>
        </div>
      </form>
    </section>
  );
}
