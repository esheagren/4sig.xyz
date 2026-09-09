import { Score } from '../../../shared/scoring';
import { scoreText } from './game';
import { formatEntry } from './number-entry';

// Broad ranges share a scale; exact and near-miss examples share a labeled detail scale.
const answer = 1776;
const examples = [
  { label: 'Wide', lower: 500, upper: 5000 },
  { label: 'Close', lower: 1000, upper: 2000 },
  { label: 'Very close', lower: 1600, upper: 1900 },
  { label: 'Exact', lower: answer, upper: answer },
  { label: 'Miss', lower: 1778, upper: 1780 },
];

export function ScoringExamples() {
  return <section className="scoring-examples" aria-label="Range scoring examples">
    <p className="scoring-legend"><span aria-hidden="true">●</span> Answer: 1,776 feet</p>
    <ol>
      {examples.map(({ label, lower, upper }) => {
        const score = Score.calculateScore(lower, upper, answer);
        const exact = lower === upper;
        const detail = exact || label === 'Miss';
        const x = (value: number) => 8 + (detail ? (value - 1774) / 8 : value / 5500) * 284;
        return <li key={label} className={score === 0 ? 'scoring-miss' : 'scoring-hit'}>
          <div className="scoring-example-heading">
            <span>{label} <small>{formatEntry(String(lower))}{!exact && `–${formatEntry(String(upper))}`}</small></span>
            <strong>{scoreText(score)} <small>pts</small></strong>
          </div>
          {detail && <p className="scoring-detail-label">Zoomed · 1,774–1,782 feet</p>}
          <svg viewBox="0 0 300 32" role="img" aria-label={`${label}: ${lower}${exact ? '' : ` to ${upper}`} feet, ${scoreText(score)} points`}>
            <path className="example-axis" d="M8 16H292" />
            <path className="example-answer-guide" d={`M${x(answer)} 0V32`} />
            {!exact && <rect className="example-range" x={x(lower)} y="8" width={x(upper) - x(lower)} height="16" />}
            <path className="example-brackets" d={`M${x(lower) + 4} 6H${x(lower)}V26H${x(lower) + 4} M${x(upper) - 4} 6H${x(upper)}V26H${x(upper) - 4}`} />
            {exact && <circle className="example-exact" cx={x(answer)} cy="16" r="8" />}
            <circle className="example-answer" cx={x(answer)} cy="16" r="3.5" />
          </svg>
        </li>;
      })}
    </ol>
    <p className="scoring-takeaway">Miss the answer: zero. Contain it: tighter earns more.</p>
  </section>;
}
