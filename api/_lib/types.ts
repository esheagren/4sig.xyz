// Core data types for API

export interface User {
  avatarIcon?: string | null;
  avatarColor?: string | null;
  hasPersonality?: boolean;
  sessionCount?: number;
  id: string;
  deviceId: string | null;
  authId: string | null;
  email: string | null;
  username: string;
  isAnonymous: boolean;
  emailVerified: boolean;
  createdAt: Date;
  lastPlayedAt: Date | null;
  timezone: string;
  totalScore: number;
  averageScore: number;
  weeklyScore: number;
  gamesPlayed: number;
  questionsCaptured: number;
  calibrationRate: number;
  currentStreak: number;
  bestStreak: number;
  bestSingleScore: number;
  themePreference: string;
}

export interface AuthUser {
  userId: string;
  authId: string | null;
  isAnonymous: boolean;
}

export interface Question {
  scoringReference?: number;
  id: string;
  prompt: string;
  unit?: string;
  trueValue: number;
  source?: string;
  sourceUrl?: string;
  answerContext?: string;
}

export interface Answer {
  judgement?: Judgement;
  questionId: string;
  lower: number;
  upper: number;
  submittedAt: Date;
}

export interface Session {
  sessionId: string;
  questionIds: string[];
  answers: Answer[];
}

export interface CrowdGuess {
  min: number;
  max: number;
}

export interface CrowdData {
  guesses: CrowdGuess[];
  avgMin: number;
  avgMax: number;
  avgHit: boolean;
  hitRate: number;
  totalResponses: number;
}

export interface Judgement {
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
  crowdData?: CrowdData;
}

export interface TodayLeaderboardEntry {
  avatarIcon?: string;
  avatarColor?: string;
  rank: number;
  username: string;
  score: number;
  isCurrentUser?: boolean;
}

export interface DailyStats {
  dailyRank: number | null;
  topScoreToday: number | null;
  todaysAverage: number | null;
  userScoreToday: number | null;
  calibrationToday: number | null;
  totalParticipantsToday: number;
  todayLeaderboard?: TodayLeaderboardEntry[];
}

export interface PerformanceHistoryEntry {
  date: string;
  day: string;
  userScore: number;
  avgScore: number;
  calibration: number;
}

export interface Feedback {
  id: string;
  userId: string | null;
  feedbackText: string;
  createdAt: Date;
  userAgent: string | null;
  pageUrl: string | null;
}
