import { forwardRef, useEffect, useRef, useState } from 'react';

interface Judgement {
  hit: boolean;
  score: number;
}

interface ScoreRevealSectionProps {
  judgements: Judgement[];
  score: number;
  calibration?: number;
  percentile?: number;
  streak?: number;
  onCumulativeScore?: (score: number) => void;
  onShareImage: () => void;
  onShareText: () => void;
  isSharing: boolean;
  shareTextCopied: boolean;
}

// Delay before the first score increment lands, and between increments.
// Long enough to build anticipation, short enough to never feel like waiting.
const REVEAL_START_MS = 600;
const REVEAL_STEP_MS = 700;

export const ScoreRevealSection = forwardRef<HTMLElement, ScoreRevealSectionProps>(({
  judgements,
  score,
  calibration,
  percentile,
  streak,
  onCumulativeScore,
  onShareImage,
  onShareText,
  isSharing,
  shareTextCopied,
}, ref) => {
  const [revealedCount, setRevealedCount] = useState(0);
  const [revealDone, setRevealDone] = useState(false);
  const onCumulativeScoreRef = useRef(onCumulativeScore);
  onCumulativeScoreRef.current = onCumulativeScore;

  const total = judgements.length;
  const hits = judgements.filter(j => j.hit).length;
  const perfect = total > 0 && hits === total;

  // Reveal sequence: score lands in discrete pulses, one per question.
  // Each step pushes the cumulative score up to the orb via callback.
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || total === 0) {
      setRevealedCount(total);
      setRevealDone(true);
      onCumulativeScoreRef.current?.(score);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < total; i++) {
      timers.push(setTimeout(() => {
        setRevealedCount(i + 1);
        const cumulative = judgements
          .slice(0, i + 1)
          .reduce((sum, j) => sum + j.score, 0);
        onCumulativeScoreRef.current?.(cumulative);
      }, REVEAL_START_MS + i * REVEAL_STEP_MS));
    }
    timers.push(setTimeout(() => {
      setRevealDone(true);
    }, REVEAL_START_MS + total * REVEAL_STEP_MS + 200));

    return () => timers.forEach(clearTimeout);
    // Run once per result set - judgements identity is stable for a session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, score]);

  return (
    <section className="score-reveal-section" ref={ref}>
      {/* The orb (fixed, top-center) lives above this spacer */}
      <div className="reveal-content">
        {/* Per-question hit/miss pips fill in as the reveal progresses */}
        <div className="reveal-pips" aria-label={`${hits} of ${total} captured`}>
          {judgements.map((j, i) => (
            <span
              key={i}
              className={`reveal-pip ${i < revealedCount ? (j.hit ? 'pip-hit' : 'pip-miss') : 'pip-pending'}`}
            />
          ))}
        </div>

        <div className={`reveal-details ${revealDone ? 'visible' : ''}`}>
          {perfect && (
            <div className="reveal-perfect">Perfect calibration</div>
          )}

          <div className="reveal-chips">
            <div className="reveal-chip">
              <span className="reveal-chip-value">{hits}/{total}</span>
              <span className="reveal-chip-label">captured</span>
            </div>
            {calibration !== undefined && (
              <div className="reveal-chip">
                <span className="reveal-chip-value">{Math.round(calibration)}%</span>
                <span className="reveal-chip-label">calibration</span>
              </div>
            )}
            {percentile !== undefined && (
              <div className="reveal-chip">
                <span className="reveal-chip-value">top {Math.max(1, 100 - percentile)}%</span>
                <span className="reveal-chip-label">today</span>
              </div>
            )}
          </div>

          {streak !== undefined && streak >= 2 && (
            <div className="reveal-streak">🔥 {streak}-day streak</div>
          )}

          <div className="share-row">
            <button
              className="share-btn share-btn-primary"
              onClick={onShareImage}
              disabled={isSharing}
            >
              {isSharing ? 'Sharing…' : 'Share your score'}
            </button>
            <button className="share-btn share-btn-secondary" onClick={onShareText}>
              {shareTextCopied ? 'Copied!' : 'Copy as text'}
            </button>
          </div>

          <div className="reveal-scroll-hint">
            <span>See your answers</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
});

ScoreRevealSection.displayName = 'ScoreRevealSection';
