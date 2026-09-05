import { useState } from "react";
import type { FormEvent } from "react";
import { playerIcons, validUsername } from "./player";
import type { Player, PlayerIcon } from "./player";

export function PlayerMark({ icon }: { icon: PlayerIcon }) {
  return (
    <svg
      className={`player-mark mark-${icon}`}
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon === "orbit" && (
        <>
          <circle cx="20" cy="20" r="12" />
          <circle cx="20" cy="20" r="3" fill="currentColor" stroke="none" />
          <circle cx="20" cy="8" r="3" fill="currentColor" stroke="none" />
        </>
      )}
      {icon === "spark" && (
        <path d="m20 5 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z" />
      )}
      {icon === "wave" && <path d="M5 20c5-19 10-19 15 0s10 19 15 0" />}
      {icon === "diamond" && (
        <>
          <path d="m20 5 15 15-15 15L5 20Z" />
          <path d="m20 14 6 6-6 6-6-6Z" />
        </>
      )}
      {icon === "crosshair" && (
        <>
          <circle cx="20" cy="20" r="10" />
          <path d="M20 4v9m0 14v9M4 20h9m14 0h9" />
        </>
      )}
    </svg>
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
    [icon, setIcon] = useState<PlayerIcon>(initial.icon ?? "spark");
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
      await onStart({ username: name, icon });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start. Try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="identity-screen">
      <div className="identity-preview" key={icon}>
        <PlayerMark icon={icon} />
      </div>
      <h1>{initial.username ? "Your next round." : "Make your mark."}</h1>
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
          aria-describedby="username-help identity-error"
          placeholder="Your name"
          disabled={pending}
          readOnly={!!initial.username}
        />
        {!initial.username && (
          <p id="username-help" className="identity-help">
            3–20 letters, numbers or underscores.
          </p>
        )}
        <fieldset disabled={pending} className="icon-picker">
          <legend>Your symbol</legend>
          <div>
            {playerIcons.map((item) => (
              <label key={item.id} title={item.label}>
                <input
                  type="radio"
                  name="player-icon"
                  value={item.id}
                  checked={icon === item.id}
                  onChange={() => setIcon(item.id)}
                  aria-label={item.label}
                />
                <span>
                  <PlayerMark icon={item.id} />
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <p id="identity-error" className="identity-error" role="status">
          {error}
        </p>
        <button
          type="submit"
          className="primary"
          disabled={pending || !validUsername(username.trim())}
        >
          {pending ? "Starting…" : "Play"}
          <span aria-hidden="true">→</span>
        </button>
      </form>
    </section>
  );
}
