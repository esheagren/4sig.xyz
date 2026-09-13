import type { Result } from "./game";
import { scoreText } from "./game";
import { SourceLinks } from "./SourceLinks";
import "./answer-review.css";
import {
  reviewInsight,
  reviewNumber as number,
  reviewRange,
} from "./answer-review-data";

const valueWithUnit = (value: number, unit: string) =>
  unit === "%"
    ? `${number(value)}%`
    : unit === "US dollars"
      ? `$${number(value)}`
      : `${number(value)}${unit ? ` ${unit}` : ""}`;

export function AnswerRange({ result }: { result: Result }) {
  const { lower, upper, question, hit } = result;
  const actual = question.answer;
  const { l, u, a } = reviewRange(lower, upper, actual);
  const label =
    question.unit.length > 12
      ? number(actual)
      : valueWithUnit(actual, question.unit);
  const labelHalf = label.length * 3.6;
  const anchor =
    a - labelHalf < 8 ? "start" : a + labelHalf > 312 ? "end" : "middle";
  const exact = lower === upper,
    close = u - l < 64;
  return (
    <svg
      className={`answer-review-range ${hit ? "is-hit" : "is-miss"}`}
      viewBox="0 0 320 85"
      role="img"
      aria-label={`Your range: ${valueWithUnit(lower, question.unit)} to ${valueWithUnit(upper, question.unit)}. Actual answer: ${valueWithUnit(actual, question.unit)}. ${hit ? "In range." : "Outside your range."}`}
    >
      <path className="review-axis" d="M14 43H306" />
      {!exact && (
        <rect className="review-band" x={l} y="35" width={u - l} height="16" />
      )}
      <path
        className="review-brackets"
        d={`M${l + 4} 31H${l}V55H${l + 4} M${u - 4} 31H${u}V55H${u - 4}`}
      />
      {exact && <circle className="review-exact" cx={l} cy="43" r="7" />}
      <path className="review-pin" d={`M${a} 24V43`} />
      <circle className="review-answer" cx={a} cy="43" r="4" />
      <text className="review-actual" x={a} y="14" textAnchor={anchor}>
        {label}
      </text>
      {close ? (
        <text
          className="review-bound"
          x={(l + u) / 2}
          y="75"
          textAnchor="middle"
        >
          {exact ? number(lower) : `${number(lower)} – ${number(upper)}`}
        </text>
      ) : (
        <>
          <text className="review-bound" x={l} y="75" textAnchor="middle">
            {number(lower)}
          </text>
          <text className="review-bound" x={u} y="75" textAnchor="middle">
            {number(upper)}
          </text>
        </>
      )}
    </svg>
  );
}

export function AnswerReview({ results }: { results: Result[] }) {
  return (
    <section
      className="answer-review"
      aria-label="Your answers and why they matter"
    >
      <div className="answer-review-heading">
        <h2 tabIndex={-1}>Today’s questions</h2>
        <p>
          <span className="review-dot" /> Actual answer{" "}
          <span className="review-legend-bracket">[—]</span> Your range
        </p>
      </div>
      <ol>
        {results.map((result, index) => {
          const insight = reviewInsight(
            result.question.context,
            result.question.insight,
          );
          return (
            <li key={result.question.id} className="answer-review-item">
              <div className="answer-review-meta">
                <span>
                  {String(index + 1).padStart(2, "0")} <b>·</b>{" "}
                  {result.question.category}
                </span>
                <strong className={!result.hit ? "review-score-miss" : ""}>
                  {scoreText(result.score)} <small>pts</small>
                </strong>
              </div>
              <h3>{result.question.short}</h3>
              {result.question.unit.length > 12 && (
                <p className="review-unit">{result.question.unit}</p>
              )}
              <AnswerRange result={result} />
              {insight && (
                <details className="answer-insight">
                  <summary>
                    <span>{insight.short}</span>
                    <span className="insight-toggle" aria-hidden="true" />
                  </summary>
                  <div className="answer-insight-more">
                    {insight.more && <p>{insight.more}</p>}
                    <SourceLinks
                      urls={[
                        ...insight.sources.map((source) => source.url),
                        result.question.url,
                      ].join(";")}
                      names={[
                        ...insight.sources.map((source) => source.label),
                        result.question.source,
                      ].join(";")}
                    />
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
