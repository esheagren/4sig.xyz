import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { PlayerMark } from "../components/interval/PlayerIdentity";
import {
  colorName,
  playerLabel,
  playerSymbol,
} from "../components/interval/player";
import type { SharedScore } from "../components/interval/player";
import { scoreText } from "../components/interval/game";
export function SharedScorePage() {
  const { id } = useParams();
  const [score, setScore] = useState<SharedScore | null>(null),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false),
    [fallback, setFallback] = useState(false),
    [paused, setPaused] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    void fetch("/api/share?id=" + encodeURIComponent(id ?? ""), {
      signal: abort.signal,
    })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            r.status === 404
              ? "This score could not be found."
              : "Could not load the score. Please try again.",
          );
        return r.json();
      })
      .then(setScore)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => abort.abort();
  }, [id]);
  useEffect(() => {
    if (score)
      document.title = `${score.player.username} · ${scoreText(score.score)} points · Four Sigma`;
    return () => {
      document.title = "Four Sigma — Room to be wrong";
    };
  }, [score]);
  const text = score
    ? `4σ · ${score.edition}${score.isRanked ? "" : " · Practice"}\n${playerSymbol(score.player.icon)} ${score.player.username} · ${playerLabel(score.player.icon)} / ${colorName(score.player.color)}\n${scoreText(score.score)} pts · ${score.hits.filter(Boolean).length}/${score.hits.length} in range\n${score.hits.map((hit) => (hit ? "■" : "□")).join("")}\nhttps://4sig.xyz/share/${score.id}`
    : "";
  return (
    <div className="interval-page">
      <div
        className="interval-app shared-score-page"
        style={{ "--player-color": score?.player.color } as CSSProperties}
      >
        <main>
          {score ? (
            <section className="summary">
              <div className="result-brand brand" aria-label="Four Sigma">
                4<span>σ</span>
              </div>
              <div className="shared-personality">
                <PlayerMark
                  icon={score.player.icon}
                  color={score.player.color}
                  paused={paused}
                />
                <button
                  className="motion-toggle text-button"
                  aria-label={
                    paused
                      ? "Play identity animation"
                      : "Pause identity animation"
                  }
                  aria-pressed={paused}
                  onClick={() => setPaused(!paused)}
                >
                  {paused ? "▷" : "Ⅱ"}
                </button>
              </div>
              <div className="result-person">{score.player.username}</div>
              <p className="personality-signature">
                {playerLabel(score.player.icon)} ·{" "}
                {colorName(score.player.color)}
              </p>
              <h1>{score.isRanked ? "Daily score" : "Practice score"}</h1>
              <div className="final-score score-reveal">
                {scoreText(score.score)}
                <span>points</span>
              </div>
              <p className="summary-caption">
                {score.hits.filter(Boolean).length}/{score.hits.length} in range
                · {score.edition}
              </p>
              <div className="share-tiles" aria-label="Round results">
                {score.hits.map((hit, i) => (
                  <span
                    key={i}
                    className={hit ? "hit" : ""}
                    aria-label={hit ? "In range" : "Outside range"}
                  >
                    {hit ? "✓" : "×"}
                  </span>
                ))}
              </div>
              <Link className="primary" to="/">
                Play Four Sigma<span>→</span>
              </Link>
              <button
                className="text-button reshare"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(text);
                    setCopied(true);
                  } catch {
                    setFallback(true);
                  }
                }}
              >
                Share Score
              </button>
              <p className="copy-status" role="status">
                {copied ? "Score copied ✓" : ""}
              </p>
              {fallback && (
                <textarea
                  className="share-fallback"
                  aria-label="Shareable score"
                  readOnly
                  value={text}
                  onFocus={(e) => e.target.select()}
                />
              )}
            </section>
          ) : (
            <section className="identity-screen account-loading">
              <p role="status">{error || "Opening score…"}</p>
              {error && (
                <Link className="primary" to="/">
                  Play →
                </Link>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
