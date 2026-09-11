import { normalizeStyle, type PlayerStyle } from '../../shared/player-profile';
import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthModal } from "../components/nav/AuthModal";
import {
  PlayerMark,
  PersonalityPicker,
} from "../components/interval/PlayerIdentity";
import { normalizeColor, normalizeIcon } from "../components/interval/player";
import { CalibrationScore } from '../components/interval/CalibrationScore';
import '../components/interval/onboarding.css';
import { scoreText } from "../components/interval/game";
import { ProfileSettings } from '../components/interval/ProfileSettings';
import type { PlayerIcon } from "../components/interval/player";
export function PlayerPanel() {
  const usernameId = useId();
  const { user, isLoading, refreshUser, logout } = useAuth();
  const [history, setHistory] = useState<
    Array<{ date: string; userScore: number; avgScore: number }>
  >([]);
  const [icon, setIcon] = useState<PlayerIcon>("orbit"),
    [color, setColor] = useState(normalizeColor(null)),
    [style, setStyle] = useState<PlayerStyle>('orbit');
  const [authOpen, setAuthOpen] = useState(false),
    [editing, setEditing] = useState(false),
    [username, setUsername] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    const abort = new AbortController();
    void fetch("/api/user/performance-history", { signal: abort.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => setHistory(data.history))
      .catch((e) => {
        if (e.name !== "AbortError")
          setError("Could not load your history. Please reload.");
      });
    return () => abort.abort();
  }, [user]);
  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: username,
          avatarIcon: icon,
          avatarColor: color,
          scorecardStyle: style,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      await refreshUser();
      setEditing(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
    }
  }
  return (
    <div className="profile-page player-panel">
        <main>
          {isLoading ? (
            <p>Loading…</p>
          ) : !user || user.isAnonymous ? (
            <>
              <h3>Your profile</h3>
              <p>Finish your starting quiz and claim a username to save your progress.</p>
              <Link className="primary" to="/">
                Play →
              </Link>
            </>
          ) : (
            <>
              <div className="result-person">
                <PlayerMark
                  color={normalizeColor(user.avatarColor)}
                  icon={normalizeIcon(user.avatarIcon)}
                />
                <h3>{user.displayName}</h3>
              </div>
              {editing ? (
                <form className="profile-name" onSubmit={saveName}>
                  <label htmlFor={usernameId}>Username</label>
                  <input
                    id={usernameId}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    pattern="[a-zA-Z0-9_]{3,20}"
                    minLength={3}
                    maxLength={20}
                    required
                  />
                  <PersonalityPicker
                    icon={icon}
                    color={color}
                    style={style}
                    onChange={(i, c, s) => {
                      setStyle(s);
                      setIcon(i);
                      setColor(c);
                    }}
                  />
                  <button className="primary">Save</button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  className="text-button"
                  onClick={() => {
                    setUsername(user.displayName);
                    setIcon(normalizeIcon(user.avatarIcon));
                    setColor(normalizeColor(user.avatarColor));
                    setStyle(normalizeStyle(user.scorecardStyle, user.avatarIcon));
                    setEditing(true);
                  }}
                >
                  Edit personality
                </button>
              )}
              <dl className="profile-stats-grid">
                {[
                  [scoreText(user.totalScore), "Total points"],
                  [user.gamesPlayed, "Daily games"],
                  [scoreText(user.averageScore), "Average score"],
                  [Math.round(user.calibrationRate * 1000) / 10 + "%", "Calibration · target 95%"],
                  [user.currentStreak, "Day streak"],
                  [user.bestStreak, "Best streak"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <dt>{l}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="onboarding-note">Overall points and calibration include your starting calibration and ranked daily answers. Daily averages and streaks count daily rounds only.</p>
              <details className="profile-history"><summary>Calibration & history</summary>
              {user.onboarding ? <section>
                <h2>Your starting calibration</h2>
                <CalibrationScore score={user.onboarding.score} hits={user.onboarding.hits} count={user.onboarding.count} initial />
                <Link className="text-button baseline-link" to="/?onboarding=1">Explore your original answers</Link>
              </section> : <Link className="text-button baseline-link" to="/?onboarding=1">Start with eight questions to find your baseline</Link>}
              <h2>Last 7 days</h2>
              <p className="muted">First attempts only.</p>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Your score</th>
                    <th>Daily average</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((day) => (
                    <tr key={day.date}>
                      <td>{day.date.slice(5)}</td>
                      <td>{scoreText(day.userScore)}</td>
                      <td>{scoreText(day.avgScore)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </details>
              {!user.email ? (
                <div className="profile-account">
                  <p>
                    Your profile is saved in this browser. Add an email and
                    password to sign in on another device.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setAuthOpen(true)}
                  >
                    Add sign-in
                  </button>
                </div>
              ) : (
                <div className="profile-account">
                  <p>{user.email}</p>
                  <button className="text-button" onClick={() => void logout()}>
                    Sign out
                  </button>
                </div>
              )}
            </>
          )}
          <ProfileSettings />
          <p role="status" className="entry-error">
            {error}
          </p>
        </main>
        <AuthModal
          isOpen={authOpen}
          onClose={() => setAuthOpen(false)}
          initialMode="signup"
        />
    </div>
  );
}
