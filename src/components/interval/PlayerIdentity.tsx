import { inkStyles, playerScorecard } from '../../../shared/ink-collection';
import { normalizeStyle, type PlayerStyle } from '../../../shared/player-profile';
import type { ScorecardData } from '../../../shared/scorecard';
import { ScoreCard } from './ScoreCard';
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
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

function identityDraft(initial: Partial<Player>): Player {
  try {
    const stored = JSON.parse(sessionStorage.getItem('four_sigma_identity_draft') ?? 'null');
    if (stored && !initial.icon) return { username: initial.username ?? stored.username ?? '', icon: normalizeIcon(stored.icon), color: normalizeColor(stored.color), style: normalizeStyle(stored.style, stored.icon) };
  } catch { /* Storage is optional. */ }
  return { username: initial.username ?? '',
    style: initial.style,
    icon: initial.icon ?? playerIcons[Math.floor(Math.random() * playerIcons.length)].id,
    color: initial.color ?? playerColors[Math.floor(Math.random() * playerColors.length)].value };
}

export function PlayerIdentity({
  initial,
  onStart,
  score,
  onboarding = false,
}: {
  initial: Partial<Player>;
  score?: Omit<ScorecardData, 'player' | 'design'>;
  onboarding?: boolean;
  onStart: (player: Player) => Promise<void>;
}) {
  const [draft] = useState(() => identityDraft(initial));
  const [username, setUsername] = useState(draft.username),
    [icon, setIcon] = useState<PlayerIcon>(draft.icon),
    [color, setColor] = useState(draft.color),
    [style, setStyle] = useState(normalizeStyle(draft.style, draft.icon));
  const preview = useMemo(() => score ? playerScorecard({ ...score, player: { username: username || 'your_name', icon, color, style } }) : null, [score, username, icon, color, style]);
  const [availability, setAvailability] = useState<{ name: string; state: 'checking' | 'available' | 'taken' | 'error' }>({name: '', state: 'checking'});
  useEffect(() => {
    try { sessionStorage.setItem('four_sigma_identity_draft', JSON.stringify({ username, icon, color, style })); } catch { /* Optional. */ }
  }, [username, icon, color, style]);
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
      await onStart({ username: name, icon, color, style });
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
          <h1>Claim username</h1>
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
          style={style}
          disabled={pending}
          onChange={(i, c, s) => {
            setStyle(s);
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
            placeholder="Claim username"
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
        {preview && <div className="identity-scorecard-preview"><ScoreCard data={preview} /></div>}
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
