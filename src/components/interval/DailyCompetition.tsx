import { scoreText } from "./game";

import { competitionValues, type CompetitionStats } from "./competition-stats";

const ordinal = (value: number) => {
  const suffix =
    value % 100 >= 11 && value % 100 <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" }[value % 10] ?? "th");
  return `${value}${suffix}`;
};

export function DailyCompetition({
  score,
  stats,
  personalAverage,
  games,
}: {
  score: number;
  stats: CompetitionStats | null;
  personalAverage: number | null;
  games: number;
}) {
  const values = competitionValues(score, stats);
  return (
    <div className="story-competition" aria-label="Daily comparisons">
      {values && values.count > 1 ? (
        <>
          <dl className="story-competition-grid">
            {values.percentile !== null && (
              <div>
                <dt>Ahead of</dt>
                <dd>
                  {values.percentile}
                  <small>%</small>
                </dd>
              </div>
            )}
            <div>
              <dt>Daily rank</dt>
              <dd>
                {ordinal(values.rank)}
                <small> / {values.count.toLocaleString("en-US")}</small>
              </dd>
            </div>
            {values.difference !== null && (
              <div>
                <dt>vs daily average</dt>
                <dd className={values.difference > 0 ? "is-ahead" : undefined}>
                  {values.difference > 0 ? "+" : ""}
                  {values.difference}
                  <small>%</small>
                </dd>
              </div>
            )}
          </dl>
          <p className="story-competition-note">
            Completed ranked games · so far today
          </p>
        </>
      ) : (
        <p className="story-competition-empty">
          {values?.count === 1
            ? "First to finish today."
            : "Daily standings will appear here."}
        </p>
      )}
      <p className="story-personal-line">
        <span>
          Your daily avg{" "}
          <strong>
            {personalAverage === null ? "—" : scoreText(personalAverage)}
          </strong>
        </span>
        <span>
          <strong>{games}</strong>{" "}
          {games === 1 ? "game played" : "games played"}
        </span>
      </p>
    </div>
  );
}
