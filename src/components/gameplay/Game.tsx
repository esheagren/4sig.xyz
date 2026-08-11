import { useState, useEffect, useRef } from 'react';
import { QuestionCard } from './QuestionCard';
import { Results } from '../results/Results';
import { LoadingOrb } from './LoadingOrb';
import { getDeviceId } from '../../lib/device';
import { useAuth } from '../../context/AuthContext';
import { useAnimation } from '../../context/AnimationContext';
import { useAnalytics } from '../../context/PostHogContext';

interface Question {
  id: string;
  prompt: string;
  unit?: string;
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
  };
}

interface TodayLeaderboardEntry {
  rank: number;
  username: string;
  score: number;
  isCurrentUser?: boolean;
}

interface OverallLeaderboardEntry {
  rank: number;
  displayName: string;
  totalScore: number;
  gamesPlayed: number;
  isCurrentUser?: boolean;
}

interface DailyStats {
  dailyRank: number | null;
  topScoreToday: number | null;
  todaysAverage: number | null;
  userScoreToday: number | null;
  calibrationToday: number | null;
  totalParticipantsToday: number;
  todayLeaderboard?: TodayLeaderboardEntry[];
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

interface OverallStanding {
  percentile: number;
  totalPlayers: number;
}

interface FinalizeResponse {
  judgements: Judgement[];
  score: number;
  totalQuestions: number;
  dailyStats?: DailyStats;
  performanceHistory?: PerformanceHistoryEntry[];
  calibrationMilestones?: CalibrationMilestone[];
  overallLeaderboard?: OverallLeaderboardEntry[];
  overallStanding?: OverallStanding;
}

export function Game() {
  const { authToken, isLoading: authLoading, refreshUser } = useAuth();
  const { animationPhase, triggerRevealAnimation } = useAnimation();
  const { capture } = useAnalytics();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<FinalizeResponse | null>(null);
  const [isFinalizingSession, setIsFinalizingSession] = useState(false);
  const [cumulativeScore, setCumulativeScore] = useState(0);

  // Track response time for each question
  const questionStartTime = useRef<number>(Date.now());

  // Compute render states based on animation phase
  const isFadingOut = animationPhase === 'fadeOut';
  const isRevealing = animationPhase === 'reveal';
  // Hide question card once we start finalizing (prevents flicker if API is slower than animation)
  const showQuestionCard = !results && !isFinalizingSession && (animationPhase === 'idle' || isFadingOut);
  // Orb: only show when results exist and animation is complete (idle)
  // Progressive reveal: orb starts at 0 and builds as user scrolls
  const showOrb = results && animationPhase === 'idle';
  const showScoreInOrb = results && animationPhase === 'idle';
  const showResults = results && ['reveal', 'idle'].includes(animationPhase);

  // Handle scroll progress from Results carousel - cumulative score builds as user scrolls
  const handleResultsScroll = (_progress: number, cumScore: number) => {
    setCumulativeScore(cumScore);
  };

  // Orb position: fixed at top-right, aligned with nav bar icon
  // Progressive reveal: orb stays in place, score builds as user scrolls through questions
  const orbStyle = {
    top: '5%',
    left: 'auto',
    right: '5%',
    transform: 'translateY(-50%) scale(0.25)',
  };

  // Helper to get auth headers
  const getHeaders = (): HeadersInit => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Device-Id': getDeviceId(),
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
  };

  const startSession = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);
    setCurrentQuestionIndex(0);

    try {
      const response = await fetch('/api/session/start', {
        method: 'POST',
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to start session');
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setQuestions(data.questions);

      // Track session start
      capture('game_session_started', {
        sessionId: data.sessionId,
        questionCount: data.questions.length,
      });

      // Reset timer for first question
      questionStartTime.current = Date.now();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      capture('game_error', {
        error: 'session_start_failed',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Wait for auth to be ready before starting session
  // This ensures the user record exists before we try to associate it with the session
  useEffect(() => {
    if (!authLoading) {
      startSession();
    }
  }, [authLoading]);

  // Track question views when index changes
  useEffect(() => {
    if (sessionId && questions[currentQuestionIndex]) {
      capture('question_viewed', {
        sessionId,
        questionId: questions[currentQuestionIndex].id,
        questionIndex: currentQuestionIndex,
        totalQuestions: questions.length,
      });
      // Reset timer for new question
      questionStartTime.current = Date.now();
    }
  }, [currentQuestionIndex, sessionId, questions.length]);

  const handleSubmitAnswer = async (lower: number, upper: number) => {
    if (!sessionId || !questions[currentQuestionIndex]) return;

    const responseTimeMs = Date.now() - questionStartTime.current;
    const currentQuestion = questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    // Track answer submission (fire-and-forget)
    capture('answer_submitted', {
      sessionId,
      questionId: currentQuestion.id,
      questionIndex: currentQuestionIndex,
      lowerBound: lower,
      upperBound: upper,
      intervalWidth: upper - lower,
      responseTimeMs,
      isLastQuestion,
    });

    // OPTIMISTIC UI: Advance to next question immediately, don't wait for API
    if (!isLastQuestion) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // FINAL QUESTION - trigger dramatic reveal animation
      setIsFinalizingSession(true);
    }

    // Submit answer to API in background
    try {
      const response = await fetch('/api/session/answer', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          sessionId,
          questionId: currentQuestion.id,
          lower,
          upper,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Submit answer error:', response.status, errorData);
        // Don't throw - we've already advanced the UI
        // The answer will be missing at finalize time, which is handled gracefully
      }
    } catch (err) {
      console.error('Submit answer exception:', err);
      // Don't set error state - allow user to continue playing
      // Missing answers will be handled at finalize
      capture('game_error', {
        error: 'answer_submit_failed',
        sessionId,
        questionIndex: currentQuestionIndex,
      });
    }

    // For last question, run animation and finalize in parallel
    if (isLastQuestion) {
      await Promise.all([
        triggerRevealAnimation(),
        finalizeSession(),
      ]);
    }
  };

  const finalizeSession = async () => {
    if (!sessionId) return;

    try {
      const response = await fetch('/api/session/finalize', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to finalize session');
      }

      const data: FinalizeResponse = await response.json();
      setResults(data);

      // Track session completion with rich context
      const hits = data.judgements.filter((j: Judgement) => j.hit).length;
      const calibration = data.judgements.length > 0
        ? (hits / data.judgements.length) * 100
        : 0;

      capture('game_session_completed', {
        sessionId,
        totalScore: data.score,
        hits,
        misses: data.totalQuestions - hits,
        totalQuestions: data.totalQuestions,
        calibration,
        dailyRank: data.dailyStats?.dailyRank ?? null,
        topScoreToday: data.dailyStats?.topScoreToday ?? null,
        totalParticipantsToday: data.dailyStats?.totalParticipantsToday ?? null,
      });

      // Refresh user data to get updated stats (games_played, total_score, etc.)
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      capture('game_error', {
        error: 'finalize_failed',
        sessionId,
      });
    }
  };

  // Show loading while auth is initializing OR while session is loading
  if (authLoading || isLoading) {
    return (
      <div className="game-container">
        <LoadingOrb />
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-container">
        <div className="error">
          <p>Error: {error}</p>
          <button onClick={startSession} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Extract daily stats from response (when available)
  const dailyStats = results?.dailyStats;
  const performanceHistory = results?.performanceHistory;
  const calibrationMilestones = results?.calibrationMilestones;
  const overallLeaderboard = results?.overallLeaderboard;
  const overallStanding = results?.overallStanding;

  // Calculate calibration from this session's judgements
  const sessionCalibration = results && results.judgements.length > 0
    ? (results.judgements.filter(j => j.hit).length / results.judgements.length) * 100
    : undefined;

  // Use today's calibration from dailyStats if available, otherwise use session calibration
  const calibration = dailyStats?.calibrationToday ?? sessionCalibration;

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="game-container">
      {/* Question Card with fade-out animation */}
      {showQuestionCard && currentQuestion && (
        <div className={`question-card-wrapper ${isFadingOut ? 'fading-out' : ''}`}>
          <QuestionCard
            question={currentQuestion}
            onSubmit={handleSubmitAnswer}
            currentQuestionIndex={currentQuestionIndex}
            totalQuestions={questions.length}
          />
        </div>
      )}

      {/* Score orb - fixed at top-right, shows cumulative score that builds as user scrolls */}
      {showOrb && (
        <div className="game-orb-container" style={orbStyle}>
          <LoadingOrb
            score={cumulativeScore}
            showScore={showScoreInOrb}
          />
        </div>
      )}

      {/* Results with reveal animation */}
      {showResults && results && (
        <div className={`results-wrapper ${isRevealing ? 'revealing' : ''}`}>
          <Results
            judgements={results.judgements}
            score={results.score}
            onRestart={startSession}
            dailyRank={dailyStats?.dailyRank ?? undefined}
            topScoreGlobal={dailyStats?.topScoreToday ?? undefined}
            dailyAverageScore={dailyStats?.todaysAverage ?? undefined}
            calibration={calibration}
            performanceHistory={performanceHistory}
            calibrationMilestones={calibrationMilestones}
            totalParticipants={dailyStats?.totalParticipantsToday ?? undefined}
            todayLeaderboard={dailyStats?.todayLeaderboard}
            overallLeaderboard={overallLeaderboard}
            overallStanding={overallStanding}
            onScroll={handleResultsScroll}
          />
        </div>
      )}
    </div>
  );
}

