import { useState } from 'react';
import { RangeVisualization } from './RangeVisualization';
import { formatNumber } from './gaussianUtils';

interface AnswerCardProps {
  index: number;
  prompt: string;
  unit?: string;
  lower: number;
  upper: number;
  trueValue: number;
  hit: boolean;
  score: number;
  answerContext?: string;
  sourceUrl?: string;
}

// One line of calibration feedback for misses: how far outside the interval
// the answer landed. Relative when the bound gives a sane base, absolute otherwise.
function nearMissText(lower: number, upper: number, trueValue: number, unit?: string): string | null {
  const above = trueValue > upper;
  const below = trueValue < lower;
  if (!above && !below) return null;

  const bound = above ? upper : lower;
  const diff = Math.abs(trueValue - bound);
  const base = Math.abs(bound) || Math.abs(trueValue);
  const direction = above ? 'above' : 'below';

  if (base > 0) {
    const pct = (diff / base) * 100;
    if (pct >= 1000) {
      return `The answer was way ${direction} your range`;
    }
    const rounded = pct < 10 ? pct.toFixed(1) : Math.round(pct).toString();
    const prefix = pct < 10 ? 'So close — just' : 'The answer was';
    return `${prefix} ${rounded}% ${direction} your range`;
  }
  return `The answer was ${formatNumber(diff)}${unit ? ` ${unit}` : ''} ${direction} your range`;
}

export function AnswerCard({
  index,
  prompt,
  unit,
  lower,
  upper,
  trueValue,
  hit,
  score,
  answerContext,
  sourceUrl,
}: AnswerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const missText = hit ? null : nearMissText(lower, upper, trueValue, unit);

  return (
    <div className={`answer-card ${hit ? 'card-hit' : 'card-miss'}`}>
      <div className="answer-card-header">
        <span className="answer-card-index">Q{index + 1}</span>
        <span className={`answer-card-points ${hit ? 'hit' : 'miss'}`}>
          {hit ? '+' : ''}{score.toLocaleString()}
        </span>
      </div>

      <p className="answer-card-prompt">{prompt}</p>

      <div className="answer-card-numbers">
        <div className="answer-card-number">
          <span className="answer-card-number-label">Your range</span>
          <span className="answer-card-number-value">
            {formatNumber(lower)} – {formatNumber(upper)}
          </span>
        </div>
        <div className="answer-card-number">
          <span className="answer-card-number-label">Answer</span>
          <span className={`answer-card-number-value ${hit ? 'hit' : 'miss'}`}>
            {formatNumber(trueValue)}{unit ? ` ${unit}` : ''}
          </span>
        </div>
      </div>

      {missText && <p className="answer-card-nearmiss">{missText}</p>}

      <button
        className="answer-card-toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {expanded ? 'Show less' : 'Learn more'}
        <svg
          className={`answer-card-chevron ${expanded ? 'open' : ''}`}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="answer-card-detail">
          <div className="answer-card-viz">
            <RangeVisualization
              userMin={lower}
              userMax={upper}
              trueValue={trueValue}
              hit={hit}
              score={score}
              unit={unit}
            />
          </div>
          {answerContext ? (
            <p className="answer-card-context">{answerContext}</p>
          ) : (
            <p className="answer-card-context answer-card-context-empty">
              No additional context for this question.
            </p>
          )}
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="explanation-source-link"
            >
              View Source
            </a>
          )}
        </div>
      )}
    </div>
  );
}
