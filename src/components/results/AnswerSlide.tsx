import { forwardRef } from 'react';
import { RangeVisualization } from './RangeVisualization';

interface CrowdData {
  avgMin: number;
  avgMax: number;
  hitRate: number;
  totalResponses: number;
}

interface AnswerSlideProps {
  prompt: string;
  unit?: string;
  lower: number;
  upper: number;
  trueValue: number;
  hit: boolean;
  score: number;
  crowdData?: CrowdData;
}

export const AnswerSlide = forwardRef<HTMLDivElement, AnswerSlideProps>(({
  prompt,
  unit,
  lower,
  upper,
  trueValue,
  hit,
  score,
}, ref) => {
  return (
    <div className="tiktok-slide answer-slide" ref={ref}>
      <div className="slide-body">
        <div className="slide-content">
          {/* Question */}
          <div className="slide-question-section">
            <h2 className="slide-question">{prompt}</h2>
          </div>

          {/* Score Badge - prominently shows this question's score */}
          <div className={`answer-score-badge ${hit ? 'hit' : 'miss'}`}>
            {hit ? '+' : ''}{score.toLocaleString()}
          </div>

          {/* Visualization */}
          <div className="slide-viz-container">
            <RangeVisualization
              userMin={lower}
              userMax={upper}
              trueValue={trueValue}
              hit={hit}
              score={score}
              unit={unit}
            />
          </div>
        </div>
      </div>

      {/* Scroll Hint */}
      <div className="slide-scroll-hint">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  );
});

AnswerSlide.displayName = 'AnswerSlide';
