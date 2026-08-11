import { useEffect, useRef, useState } from 'react';
import { ScoreRevealSection } from './ScoreRevealSection';
import { AnswerCard } from './AnswerCard';
import { DailyStatsSlide } from './DailyStatsSlide';
import { UserStatsSlide } from './UserStatsSlide';
import { ShareScoreCard, type ShareScoreCardRef } from './ShareScoreCard';
import { useAuth } from '../../context/AuthContext';
import { useAnalytics } from '../../context/PostHogContext';

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

interface OverallLeaderboardEntry {
  rank: number;
  displayName: string;
  totalScore: number;
  gamesPlayed: number;
  isCurrentUser?: boolean;
}

interface ResultsFlowProps {
  judgements: Judgement[];
  score: number;
  calibration?: number;
  dailyRank?: number;
  totalParticipants?: number;
  performanceHistory?: PerformanceHistoryEntry[];
  calibrationMilestones?: CalibrationMilestone[];
  overallLeaderboard?: OverallLeaderboardEntry[];
  onCumulativeScore?: (score: number) => void;
  onRevealVisibility?: (visible: boolean) => void;
}

export function ResultsFlow({
  judgements,
  score,
  calibration = 0,
  dailyRank,
  totalParticipants,
  performanceHistory,
  calibrationMilestones,
  overallLeaderboard,
  onCumulativeScore,
  onRevealVisibility,
}: ResultsFlowProps) {
  const { user } = useAuth();
  const { capture } = useAnalytics();
  const shareCardRef = useRef<ShareScoreCardRef>(null);
  const revealSectionRef = useRef<HTMLElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareTextCopied, setShareTextCopied] = useState(false);
  const onRevealVisibilityRef = useRef(onRevealVisibility);
  onRevealVisibilityRef.current = onRevealVisibility;

  // Tell the parent when the reveal section leaves the viewport so the
  // fixed orb can tuck into its compact HUD position over the content below
  useEffect(() => {
    const el = revealSectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => onRevealVisibilityRef.current?.(entry.isIntersecting),
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const safeJudgements = judgements ?? [];
  const hits = safeJudgements.filter(j => j.hit).length;
  const total = safeJudgements.length;

  const percentile = (dailyRank && totalParticipants && totalParticipants > 0)
    ? Math.round(((totalParticipants - dailyRank) / totalParticipants) * 100)
    : undefined;

  const handleShareImage = async () => {
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

  // Wordle-style text artifact: pastes anywhere, survives every messenger
  const handleShareText = async () => {
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const pips = safeJudgements.map(j => (j.hit ? '🟢' : '🔴')).join('');
    const text = `4σ ${dateStr} ${pips} ${score.toLocaleString()} pts\nhttps://4sig.xyz`;

    let shareMethod = 'text_clipboard';
    try {
      if (navigator.share) {
        await navigator.share({ text });
        shareMethod = 'text_native';
      } else {
        await navigator.clipboard.writeText(text);
        setShareTextCopied(true);
        setTimeout(() => setShareTextCopied(false), 2000);
      }
      capture('score_shared', { score, shareMethod, hits, total, calibration, percentile });
    } catch (error) {
      // Native share cancelled or clipboard denied - try clipboard as last resort
      try {
        await navigator.clipboard.writeText(text);
        setShareTextCopied(true);
        setTimeout(() => setShareTextCopied(false), 2000);
        capture('score_shared', { score, shareMethod: 'text_clipboard', hits, total, calibration, percentile });
      } catch {
        console.error('Error sharing text:', error);
      }
    }
  };

  return (
    <div className="results-flow">
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

      <div className="results-flow-container">
        <ScoreRevealSection
          ref={revealSectionRef}
          judgements={safeJudgements}
          score={score}
          calibration={calibration}
          percentile={percentile}
          streak={user?.currentStreak}
          onCumulativeScore={onCumulativeScore}
          onShareImage={handleShareImage}
          onShareText={handleShareText}
          isSharing={isSharing}
          shareTextCopied={shareTextCopied}
        />

        {/* All answers, one after another, each with a learn-more expander */}
        <section className="answers-section">
          <h2 className="answers-section-title">Your answers</h2>
          {safeJudgements.map((judgement, i) => (
            <AnswerCard
              key={judgement.questionId}
              index={i}
              prompt={judgement.prompt}
              unit={judgement.unit}
              lower={judgement.lower}
              upper={judgement.upper}
              trueValue={judgement.trueValue}
              hit={judgement.hit}
              score={judgement.score}
              answerContext={judgement.answerContext}
              sourceUrl={judgement.sourceUrl}
            />
          ))}
        </section>

        {/* Leaderboard + long-term stats keep their full-height sections */}
        <DailyStatsSlide
          overallLeaderboard={overallLeaderboard}
          displayName={user?.displayName || 'Player'}
        />

        <UserStatsSlide
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
  );
}
