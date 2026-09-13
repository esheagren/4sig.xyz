import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ScorecardData } from "../../../shared/scorecard";
import { ScoreCard } from "./ScoreCard";
import { ScorecardShare } from "./ScorecardShare";
import { scoreText, type Result } from "./game";
import { AnswerReview } from "./AnswerReview";
import { DailyCompetition } from "./DailyCompetition";
import type { CompetitionStats } from "./competition-stats";
import "./score-story.css";

export type ScoreStoryProps = {
  results: Result[];
  standings: CompetitionStats | null;
  cardData: ScorecardData;
  onboarding: boolean;
  dailyAvailable: boolean;
  onPlayDaily: () => void;
  onPractice: () => void;
};

function RisingScore({ score }: { score: number }) {
  const [shown, setShown] = useState(score);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 900);
      setShown(score * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);
  return (
    <>
      <span aria-hidden="true">{scoreText(shown)}</span>
      <span className="sr-only">{scoreText(score)} points</span>
    </>
  );
}

export function ScoreStory({
  results,
  standings,
  cardData,
  onboarding,
  dailyAvailable,
  onPlayDaily,
  onPractice,
}: ScoreStoryProps) {
  const root = useRef<HTMLDivElement>(null),
    review = useRef<HTMLElement>(null);
  const [page, setPage] = useState("score");
  const average = standings?.personalDailyAverage ?? null;
  const games = standings?.personalDailyGames ?? 0;
  const hits = results.filter((result) => result.hit).length;
  const rate = results.length ? (hits / results.length) * 100 : 0;
  const distance = Math.round(Math.abs(95 - rate) * 10) / 10;
  const goTo = (next: "score" | "questions") => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.current?.scrollTo({
      top: next === "score" ? 0 : (review.current?.offsetTop ?? 0),
      behavior: reduced ? "instant" : "smooth",
    });
    if (next === "questions")
      review.current
        ?.querySelector<HTMLElement>("h2")
        ?.focus({ preventScroll: true });
  };
  return (
    <div
      className="score-story"
      ref={root}
      data-page={page}
      data-layout={cardData.design?.layout}
      style={{ "--story-accent": cardData.player.color } as CSSProperties}
      onScroll={() => {
        const node = root.current;
        if (node)
          setPage(
            node.scrollTop > node.clientHeight / 2 ? "questions" : "score",
          );
      }}
    >
      <section
        className="score-story-hero"
        aria-label={onboarding ? "Your starting score" : "Your daily score"}
      >
        <div className="score-story-art" aria-hidden="true">
          <ScoreCard data={cardData} />
        </div>
        <div className="score-story-shade" />
        <header className="score-story-header">
          <span className="story-brand" aria-label="4 sigma">
            4<span>σ</span>
          </span>
          <span>
            {onboarding ? "Starting point" : cardData.label}
            <i />
            01 / 02
          </span>
        </header>
        <div className="score-story-main">
          <p className="score-story-name">{cardData.player.username}</p>
          <h1 className="score-story-score">
            <RisingScore score={cardData.score} />
          </h1>
          <p className="score-story-label">
            {cardData.practice
              ? "Practice score"
              : onboarding
                ? "Your starting score"
                : "Today’s score"}
            <span>points</span>
          </p>
          <div className="score-story-calibration">
            <div>
              <strong>
                {Math.round(rate * 10) / 10}
                <small>%</small>
              </strong>
              <span>Calibration</span>
            </div>
            <p>
              {distance === 0 ? "Right on target" : `${distance} pts from 95%`}
              <span>
                {hits} of {results.length} answers in range
              </span>
            </p>
          </div>
          <div
            className="score-story-gauge"
            role="img"
            aria-label={`${Math.round(rate * 10) / 10}% calibration; target 95%`}
          >
            <div className="story-gauge-line">
              <span style={{ width: `${rate}%` }} />
              <i style={{ left: `${rate}%` }} />
              <b />
            </div>
            <div className="story-gauge-labels">
              <span>0</span>
              <strong>95% target</strong>
              <span>100</span>
            </div>
          </div>
          {cardData.practice ? (
            <p className="story-practice-note">
              Practice · excluded from your totals
            </p>
          ) : !onboarding ? (
            <DailyCompetition
              score={cardData.score}
              stats={standings}
              personalAverage={average}
              games={games}
            />
          ) : (
            <dl className="score-story-stats">
              <div>
                <dt>Daily average</dt>
                <dd>{average === null ? "—" : scoreText(average)}</dd>
              </div>
            </dl>
          )}
        </div>
        <div className="score-story-actions">
          <ScorecardShare data={cardData} showCard={false} />
          <button
            className="score-story-next"
            onClick={() => goTo("questions")}
          >
            <span>Today’s questions</span>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 3v13m-5-5 5 5 5-5" />
            </svg>
          </button>
        </div>
      </section>
      <section
        className="score-story-questions"
        ref={review}
        aria-label="Today’s questions"
      >
        <div className="score-story-review-top">
          <button onClick={() => goTo("score")}>↑ Your score</button>
          <span>02 / 02</span>
        </div>
        <AnswerReview results={results} />
        {!onboarding && (
          <div className="score-story-daily">
            <button className="text-button" onClick={onPractice}>
              Practice again ↻
            </button>
          </div>
        )}
        {onboarding && (
          <div className="score-story-daily">
            {dailyAvailable ? (
              <button className="primary" onClick={onPlayDaily}>
                Play today’s questions <span>→</span>
              </button>
            ) : (
              <p>Five new questions tomorrow.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
