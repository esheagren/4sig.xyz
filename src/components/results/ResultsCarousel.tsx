import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { AnswerSlide } from './AnswerSlide';
import { ExplanationSlide } from './ExplanationSlide';
import { DailyStatsSlide } from './DailyStatsSlide';
import { UserStatsSlide } from './UserStatsSlide';
import { ShareScoreCard, type ShareScoreCardRef } from './ShareScoreCard';
import { useAuth } from '../../context/AuthContext';
import { useAnalytics } from '../../context/PostHogContext';

// Maps slide index to dot index for the indicator navigation
// Each question has 2 slides (answer + explanation) but only 1 dot
// No ScoreOrbSlide - first slide is Q1's answer
function slideIndexToDotIndex(slideIndex: number, questionCount: number): number {
  // Question slides region (indices 0 to questionCount * 2 - 1)
  const questionSlideEnd = questionCount * 2;
  if (slideIndex < questionSlideEnd) {
    // Both answer & explanation slides map to same question dot
    return Math.floor(slideIndex / 2);
  }

  // Post-question slides (DailyStats, UserStats)
  return questionCount + (slideIndex - questionSlideEnd);
}

interface CrowdData {
  avgMin: number;
  avgMax: number;
  hitRate: number;
  totalResponses: number;
}

interface CommunityStats {
  averageScore: number;
  highestScore: number;
  highestScoreUsername?: string;
  highestScoreLowerBound?: number;
  highestScoreUpperBound?: number;
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
  crowdData?: CrowdData;
  communityStats?: CommunityStats;
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

interface ResultsCarouselProps {
  judgements: Judgement[];
  score: number;
  calibration?: number;
  dailyRank?: number;
  totalParticipants?: number;
  topScoreToday?: number;
  performanceHistory?: PerformanceHistoryEntry[];
  calibrationMilestones?: CalibrationMilestone[];
  todayLeaderboard?: TodayLeaderboardEntry[];
  overallLeaderboard?: OverallLeaderboardEntry[];
  onScroll?: (progress: number, cumulativeScore: number) => void;
}

export function ResultsCarousel({
  judgements,
  score,
  calibration = 0,
  dailyRank,
  totalParticipants,
  topScoreToday,
  performanceHistory,
  calibrationMilestones,
  todayLeaderboard,
  overallLeaderboard,
  onScroll,
}: ResultsCarouselProps) {
  const { user } = useAuth();
  const { capture } = useAnalytics();
  const shareCardRef = useRef<ShareScoreCardRef>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [completedQuestions, setCompletedQuestions] = useState<number>(0);

  // Defensive check: ensure judgements is always an array
  const safeJudgements = judgements ?? [];

  // Track scroll position for discrete score updates
  // Score jumps when scrolling past each question's answer slide
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const slideHeight = window.innerHeight;
      // Current slide index (0-based, no ScoreOrbSlide offset)
      const currentSlide = Math.floor(scrollTop / slideHeight);

      // Count how many questions are "complete" (scrolled past their answer slide)
      // Each question has 2 slides: answer (even indices) + explanation (odd indices)
      // Question i's answer slide is at index i * 2
      // Question is complete when we've scrolled past its answer slide
      let newCompleted = 0;
      for (let i = 0; i < safeJudgements.length; i++) {
        const answerSlideIndex = i * 2;
        if (currentSlide > answerSlideIndex) {
          newCompleted = i + 1;
        }
      }

      // Only update if completed count changed (prevents unnecessary re-renders)
      if (newCompleted !== completedQuestions) {
        setCompletedQuestions(newCompleted);

        // Calculate cumulative score from completed questions (discrete jumps)
        const cumulativeScore = safeJudgements
          .slice(0, newCompleted)
          .reduce((sum, j) => sum + j.score, 0);

        // Notify parent of progress (unused) and cumulative score
        const progress = Math.min(scrollTop / slideHeight, 1);
        onScroll?.(progress, cumulativeScore);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [onScroll, safeJudgements, completedQuestions]);

  const hits = safeJudgements.filter(j => j.hit).length;
  const total = safeJudgements.length;
  // Each question now has 2 slides (answer + explanation)
  const questionSlideCount = safeJudgements.length * 2;
  // +2 for DailyStatsSlide, UserStatsSlide (no ScoreOrbSlide)
  const totalSlides = questionSlideCount + 2;
  // Dots: one per question + 2 non-question slides (DailyStats, UserStats)
  const totalDots = safeJudgements.length + 2;

  // Calculate active dot index from active slide index
  const activeDotIndex = useMemo(
    () => slideIndexToDotIndex(activeSlideIndex, safeJudgements.length),
    [activeSlideIndex, safeJudgements.length]
  );

  // Track which slide is currently visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const index = slideRefs.current.indexOf(entry.target as HTMLDivElement);
            if (index !== -1) {
              setActiveSlideIndex(index);
            }
          }
        });
      },
      { threshold: 0.5, root: scrollContainerRef.current }
    );

    slideRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [safeJudgements.length]);

  const setSlideRef = useCallback((index: number) => (el: HTMLDivElement | null) => {
    slideRefs.current[index] = el;
  }, []);

  // Calculate percentile
  const percentile = (dailyRank && totalParticipants && totalParticipants > 0)
    ? Math.round(((totalParticipants - dailyRank) / totalParticipants) * 100)
    : undefined;

  const handleShare = async () => {
    if (!shareCardRef.current) return;

    setIsSharing(true);

    try {
      const blob = await shareCardRef.current.generateImage();
      if (!blob) {
        throw new Error('Failed to generate image');
      }

      let shareMethod = 'unknown';

      // Try native share first
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], '4sigma-score.png', { type: 'image/png' });
        const shareData = { files: [file] };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          shareMethod = 'native_share';
          capture('score_shared', { score, shareMethod, hits, total, calibration, percentile });
          return;
        }
      }

      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        shareMethod = 'clipboard';
      } catch {
        // Final fallback: Download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '4sigma-score.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        shareMethod = 'download';
      }

      capture('score_shared', { score, shareMethod, hits, total, calibration, percentile });
    } catch (error) {
      console.error('Error sharing:', error);
      capture('share_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        score,
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="tiktok-results">
      {/* Hidden share card for image generation */}
      <ShareScoreCard
        ref={shareCardRef}
        totalScore={score}
        displayName={user?.displayName || 'Player'}
        hits={hits}
        total={total}
        calibration={calibration}
        percentile={percentile}
      />

      {/* Flex layout: dots on left, content on right */}
      <div className="results-layout">
        {/* Dot indicators - own column, no overlap */}
        {/* Each question has 1 dot (covering both answer + explanation slides) */}
        <div className="slide-dots">
          {Array.from({ length: totalDots }).map((_, i) => (
            <div
              key={i}
              className={`slide-dot ${i === activeDotIndex ? 'active' : ''}`}
            />
          ))}
        </div>

        {/* Scroll snap container */}
        <div className="tiktok-scroll-container" ref={scrollContainerRef}>
          {/* Individual question slides - each question has 2 slides */}
          {/* First slide is Q1's answer (no ScoreOrbSlide spacer) */}
          {safeJudgements.map((judgement, i) => (
            <React.Fragment key={judgement.questionId}>
              <AnswerSlide
                ref={setSlideRef(i * 2)}
                prompt={judgement.prompt}
                unit={judgement.unit}
                lower={judgement.lower}
                upper={judgement.upper}
                trueValue={judgement.trueValue}
                hit={judgement.hit}
                score={judgement.score}
                crowdData={judgement.crowdData}
              />
              <ExplanationSlide
                ref={setSlideRef(i * 2 + 1)}
                prompt={judgement.prompt}
                answerContext={judgement.answerContext}
                sourceUrl={judgement.sourceUrl}
                trueValue={judgement.trueValue}
                unit={judgement.unit}
              />
            </React.Fragment>
          ))}

          {/* Daily Stats Slide (Overall Leaderboard) */}
          <DailyStatsSlide
            ref={setSlideRef(safeJudgements.length * 2)}
            overallLeaderboard={overallLeaderboard}
          />

          {/* User Stats Slide (Long-term stats) */}
          <UserStatsSlide
            ref={setSlideRef(safeJudgements.length * 2 + 1)}
            calibration={calibration}
            performanceHistory={performanceHistory}
            calibrationMilestones={calibrationMilestones}
            userStats={user ? {
              gamesPlayed: user.gamesPlayed,
              averageScore: user.averageScore,
              bestSingleScore: user.bestSingleScore,
              currentStreak: user.currentStreak,
              bestStreak: user.bestStreak,
            } : undefined}
          />
        </div>
      </div>
    </div>
  );
}
