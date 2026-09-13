import type { Result } from "../components/interval/game";
import { scoreText } from "../components/interval/game";
import { SourceLinks } from "../components/interval/SourceLinks";
import "./answer-review.css";

// Draft editorial copy for the design study, not the live question bank.
const insights = [
  {
    short: "A population’s age helps us see what it needs.",
    more: "Younger populations may need more schools and first jobs. Older populations may need more care and pensions.",
  },
  {
    short: "Where people live shapes the homes, roads, and services they need.",
    more: "The share living in towns and cities gives us a starting point for tracking change. Countries define urban areas in different ways, so comparisons need care.",
  },
  {
    short: "This shows how many people earn a living from the land and sea.",
    more: "Farming, forestry, and fishing supply food and other basic goods. Knowing how many people do this work helps us see who may be affected by changes in weather or prices.",
  },
  {
    short: "The things we buy often depend on a journey by sea.",
    more: "Ships carry large amounts of goods between countries. Knowing their role helps explain why trouble at a port or shipping route can affect places far away.",
  },
  {
    short:
      "Knowing where our power comes from helps us judge plans to change it.",
    more: "Nuclear power is one part of the world’s electricity supply. This measure leaves out fuels burned directly in cars, homes, and factories, so it does not describe all energy use.",
  },
  {
    short: "Fresh water can be plentiful on paper and still be hard to reach.",
    more: "Much of it is frozen in ice rather than flowing in rivers or stored in lakes. Knowing where water is held helps explain why a place can face shortages even on a water-rich planet.",
  },
  {
    short: "The cost of reading DNA helps set the pace of medical research.",
    more: "Lower costs can let researchers study more genomes with the same budget. Reading the DNA is only one step, though: working out what it means takes more work and money.",
  },
  {
    short:
      "Who gets a seat helps shape whose views are heard when laws are made.",
    more: "The share of seats held by women shows one part of how political power is shared. It does not tell us everything about equal rights, but it gives us a clear way to track change.",
  },
];
const number = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
const valueWithUnit = (value: number, unit: string) =>
  unit === "%"
    ? `${number(value)}%`
    : unit === "US dollars"
      ? `$${number(value)}`
      : `${number(value)}${unit ? ` ${unit}` : ""}`;

export function AnswerRange({ result }: { result: Result }) {
  const { lower, upper, question, hit } = result;
  const actual = question.answer;
  const start = Math.min(lower, actual),
    end = Math.max(upper, actual);
  const spread = Math.max(end - start, Math.abs(actual) * 0.12, 1e-6);
  const x = (value: number) =>
    26 +
    ((value - (start - spread * 0.2)) / (end - start + spread * 0.4)) * 268;
  const l = x(lower),
    u = x(upper),
    a = x(actual);
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
      <text
        className="review-actual"
        x={a}
        y="14"
        textAnchor="middle"
      >
        {valueWithUnit(actual, question.unit)}
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
        <h2>The numbers, revisited.</h2>
        <p>
          <span className="review-dot" /> Actual answer{" "}
          <span className="review-legend-bracket">[—]</span> Your range
        </p>
      </div>
      <ol>
        {results.map((result, index) => {
          const insight = insights[Number(result.question.id.slice(-12)) - 1];
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
              <AnswerRange result={result} />
              {insight && (
                <details className="answer-insight">
                  <summary>
                    <span>{insight.short}</span>
                    <span className="insight-toggle" aria-hidden="true" />
                  </summary>
                  <div className="answer-insight-more">
                    <p>{insight.more}</p>
                    <SourceLinks
                      urls={result.question.url}
                      names={result.question.source}
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
