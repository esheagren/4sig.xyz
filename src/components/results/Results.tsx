import { ResultsFlow } from './ResultsFlow';

interface CrowdGuess {
  min: number;
  max: number;
}

interface CrowdData {
  guesses: CrowdGuess[];
  avgMin: number;
  avgMax: number;
  avgHit: boolean;
  hitRate: number;
  totalResponses: number;
}

interface Judgement {
  questionId: string;
  prompt: string;
  unit?: string;
  lower: number;
  upper: number;
  trueValue: number;
  hit: boolean;
  score: number;
  source?: string;
  sourceUrl?: string;
  answerContext?: string;
  communityStats?: {
    averageScore: number;
    highestScore: number;
    highestScoreUsername?: string;
  };
  crowdData?: CrowdData;
}

interface PerformanceHistoryEntry {
  date: string;
  day: string;
  userScore: number;
  avgScore: number;
  calibration: number;
}

interface CalibrationMilestone {
  date: string;
  label: string;
  calibration: number;
}

interface OverallLeaderboardEntry {
  rank: number;
  displayName: string;
  totalScore: number;
  gamesPlayed: number;
  isCurrentUser?: boolean;
}

interface ResultsProps {
  judgements: Judgement[];
  score: number;
  onRestart: () => void;
  dailyRank?: number;
  calibration?: number;
  performanceHistory?: PerformanceHistoryEntry[];
  calibrationMilestones?: CalibrationMilestone[];
  totalParticipants?: number;
  overallLeaderboard?: OverallLeaderboardEntry[];
  onCumulativeScore?: (score: number) => void;
  onRevealVisibility?: (visible: boolean) => void;
}

export function Results({
  judgements,
  score,
  dailyRank,
  calibration,
  performanceHistory,
  calibrationMilestones,
  totalParticipants,
  overallLeaderboard,
  onCumulativeScore,
  onRevealVisibility,
}: ResultsProps) {
  return (
    <ResultsFlow
      judgements={judgements}
      score={score}
      calibration={calibration}
      dailyRank={dailyRank}
      totalParticipants={totalParticipants}
      performanceHistory={performanceHistory}
      calibrationMilestones={calibrationMilestones}
      overallLeaderboard={overallLeaderboard}
      onCumulativeScore={onCumulativeScore}
      onRevealVisibility={onRevealVisibility}
    />
  );
}
