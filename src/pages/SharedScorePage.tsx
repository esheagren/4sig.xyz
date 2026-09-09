import { playerScorecard } from '../../shared/ink-collection';
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { ScorecardShare } from "../components/interval/ScorecardShare";
import type { ScorecardData } from "../../shared/scorecard";
import {
  colorName,
  playerLabel,
  playerSymbol,
} from "../components/interval/player";
import type { SharedScore } from "../components/interval/player";
import '../components/interval/onboarding.css';
import { scoreText } from "../components/interval/game";
export function SharedScorePage() {
  const { id } = useParams();
  const [score, setScore] = useState<SharedScore | null>(null),
    [error, setError] = useState("");
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
      document.title = "Four Sigma — Numbers that matter";
    };
  }, [score]);
  const text = score
    ? `4σ · ${score.kind === 'onboarding' ? 'Your starting calibration' : score.edition}${score.isRanked ? "" : " · Practice"}\n${playerSymbol(score.player.icon)} ${score.player.username} · ${playerLabel(score.player.icon)} / ${colorName(score.player.color)}\n${scoreText(score.score)} pts · ${score.hits.filter(Boolean).length}/${score.hits.length} in range\n${score.hits.map((hit) => (hit ? "■" : "□")).join("")}\nhttps://4sig.xyz/share/${score.id}`
    : "";
  const card = useMemo<ScorecardData | null>(() => score ? playerScorecard({ player: score.player, score: score.score, hits: score.hits,
    label: score.kind === 'onboarding' ? 'STARTING CALIBRATION' : score.edition, practice: !score.isRanked }) : null, [score]);
  return (
    <div className="interval-page">
      <div
        className="interval-app shared-score-page"
        style={{ "--player-color": score?.player.color } as CSSProperties}
      >
        <main>
          {score ? (
            <section className="summary">
              <h1 className="sr-only">{score.player.username}’s scorecard</h1>
              {card && <ScorecardShare data={card} text={text} url={`https://4sig.xyz/share/${score.id}`} />}
              <p className="shared-promise">
                A better sense of the world, four numbers at a time.
              </p>
              <Link className="primary" to="/">
                Play<span aria-hidden="true">→</span>
              </Link>
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
