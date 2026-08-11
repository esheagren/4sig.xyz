import { supabase } from './supabase.js';
import { CrowdData } from './types.js';

/**
 * Get date string in Pacific time (YYYY-MM-DD)
 * Handles PST/PDT automatically
 */
function getPacificDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

/**
 * Get start of Pacific day as ISO string
 * Returns the UTC timestamp for midnight Pacific time
 */
function getPacificDayStart(date: Date = new Date()): string {
  const dateStr = getPacificDateString(date);
  // Try PST first (UTC-8), check if the date matches
  const pstDate = new Date(dateStr + 'T00:00:00-08:00');
  const pstCheck = pstDate.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

  if (pstCheck === dateStr) {
    return pstDate.toISOString();
  }
  // Otherwise we're in PDT (UTC-7)
  return new Date(dateStr + 'T00:00:00-07:00').toISOString();
}

/**
 * Record a user's response for a question
 */
export async function recordUserResponse(
  userId: string,
  questionId: string,
  data: {
    lowerBound: number;
    upperBound: number;
    score: number;
    captured: boolean;
    answerValueAtResponse: number;
  }
): Promise<void> {
  const { error } = await supabase.from('user_responses').insert({
    user_id: userId,
    question_id: questionId,
    lower_bound: data.lowerBound,
    upper_bound: data.upperBound,
    score: data.score,
    captured: data.captured,
    answer_value_at_response: data.answerValueAtResponse,
    answered_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Failed to record user response:', error);
    throw new Error(`Failed to record response: ${error.message}`);
  }
}

/**
 * Update user aggregate stats after completing a session
 */
export async function updateUserStatsAfterSession(
  userId: string,
  sessionData: {
    sessionScore: number;
    questionsCaptured: number;
    questionsAnswered: number;
  }
): Promise<void> {
  console.log(`[updateUserStatsAfterSession] Updating stats for userId=${userId}`, JSON.stringify(sessionData));

  // First get current user stats
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('total_score, games_played, questions_captured, best_single_score, current_streak, best_streak, last_played_at')
    .eq('id', userId)
    .single();

  console.log(`[updateUserStatsAfterSession] Fetched user:`, user ? JSON.stringify(user) : 'null', fetchError ? `error: ${fetchError.message}` : '');

  if (fetchError || !user) {
    throw new Error('Failed to fetch user stats');
  }

  const newTotalScore = Number(user.total_score) + sessionData.sessionScore;
  const newGamesPlayed = user.games_played + 1;
  const newQuestionsCaptured = user.questions_captured + sessionData.questionsCaptured;
  const totalQuestionsAnswered = user.games_played * 3 + sessionData.questionsAnswered;
  const newCalibrationRate = totalQuestionsAnswered > 0
    ? newQuestionsCaptured / totalQuestionsAnswered
    : 0;
  const newAverageScore = newGamesPlayed > 0 ? newTotalScore / newGamesPlayed : 0;

  const newBestSingleScore = Math.max(Number(user.best_single_score), sessionData.sessionScore);

  // Update streak based on consecutive days played (not performance)
  // Use Pacific time for day boundaries (midnight Pacific)
  const todayPacific = getPacificDateString(new Date());
  const lastPlayedPacific = user.last_played_at
    ? getPacificDateString(new Date(user.last_played_at))
    : null;

  let newCurrentStreak = user.current_streak;

  if (!lastPlayedPacific) {
    // First time playing - start streak at 1
    newCurrentStreak = 1;
  } else {
    // Calculate days difference using date strings
    const todayDate = new Date(todayPacific + 'T00:00:00');
    const lastPlayedDate = new Date(lastPlayedPacific + 'T00:00:00');
    const daysDiff = Math.floor((todayDate.getTime() - lastPlayedDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
      // Already played today (Pacific time) - don't change streak
      newCurrentStreak = user.current_streak;
    } else if (daysDiff === 1) {
      // Played yesterday (Pacific time) - increment streak
      newCurrentStreak = user.current_streak + 1;
    } else {
      // Missed a day or more - reset streak to 1 (playing today counts)
      newCurrentStreak = 1;
    }
  }

  const newBestStreak = Math.max(user.best_streak, newCurrentStreak);

  const { error: updateError } = await supabase
    .from('users')
    .update({
      total_score: newTotalScore,
      average_score: newAverageScore,
      games_played: newGamesPlayed,
      questions_captured: newQuestionsCaptured,
      calibration_rate: newCalibrationRate,
      current_streak: newCurrentStreak,
      best_streak: newBestStreak,
      best_single_score: newBestSingleScore,
      last_played_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    console.error('Failed to update user stats:', updateError);
    throw new Error(`Failed to update user stats: ${updateError.message}`);
  }
}

/**
 * Get daily stats for a user
 * calibrationToday is cumulative (all-time) for robust measurement
 */
export async function getDailyStats(userId: string): Promise<{
  dailyRank: number | null;
  topScoreToday: number | null;
  todaysAverage: number | null;
  userScoreToday: number | null;
  calibrationToday: number | null;
  totalParticipantsToday: number;
  todayLeaderboard?: Array<{
    rank: number;
    username: string;
    score: number;
    isCurrentUser?: boolean;
  }>;
}> {
  const todayStart = getPacificDayStart();

  // Fetch today's scores for ranking
  const { data: dailyScores, error: dailyError } = await supabase
    .from('user_responses')
    .select('user_id, score, captured')
    .gte('answered_at', todayStart);

  // Fetch ALL responses for this user to calculate cumulative calibration
  const { data: allUserResponses, error: allUserError } = await supabase
    .from('user_responses')
    .select('captured')
    .eq('user_id', userId);

  if (dailyError) {
    console.error('Failed to fetch daily scores:', dailyError);
    return {
      dailyRank: null,
      topScoreToday: null,
      todaysAverage: null,
      userScoreToday: null,
      calibrationToday: null,
      totalParticipantsToday: 0,
      todayLeaderboard: undefined,
    };
  }

  // Calculate cumulative calibration from all user responses
  let cumulativeCalibration: number | null = null;
  if (!allUserError && allUserResponses && allUserResponses.length > 0) {
    const totalCaptured = allUserResponses.filter(r => r.captured).length;
    const totalAnswered = allUserResponses.length;
    cumulativeCalibration = (totalCaptured / totalAnswered) * 100;
  }

  if (!dailyScores || dailyScores.length === 0) {
    return {
      dailyRank: null,
      topScoreToday: null,
      todaysAverage: null,
      userScoreToday: null,
      calibrationToday: cumulativeCalibration,
      totalParticipantsToday: 0,
      todayLeaderboard: undefined,
    };
  }

  const userAggregates: Map<string, { totalScore: number; captured: number; total: number }> = new Map();

  for (const response of dailyScores) {
    const current = userAggregates.get(response.user_id) || { totalScore: 0, captured: 0, total: 0 };
    current.totalScore += Number(response.score);
    current.captured += response.captured ? 1 : 0;
    current.total += 1;
    userAggregates.set(response.user_id, current);
  }

  const sortedUsers = Array.from(userAggregates.entries())
    .map(([uid, stats]) => ({
      userId: uid,
      totalScore: stats.totalScore,
    }))
    .sort((a, b) => b.totalScore - a.totalScore);

  const totalParticipants = sortedUsers.length;
  const topScore = sortedUsers.length > 0 ? sortedUsers[0].totalScore : null;
  const averageScore = sortedUsers.length > 0
    ? sortedUsers.reduce((sum, u) => sum + u.totalScore, 0) / sortedUsers.length
    : null;

  const userRankIndex = sortedUsers.findIndex(u => u.userId === userId);
  const userStats = sortedUsers.find(u => u.userId === userId);

  // Generate today's leaderboard (top 10)
  let todayLeaderboard: Array<{
    rank: number;
    username: string;
    score: number;
    isCurrentUser?: boolean;
  }> | undefined;

  if (sortedUsers.length > 0) {
    // Fetch usernames for top 10 users
    const topUserIds = sortedUsers.slice(0, 10).map(u => u.userId);
    const { data: topUsers, error: usersError } = await supabase
      .from('users')
      .select('id, username')
      .in('id', topUserIds);

    if (!usersError && topUsers) {
      todayLeaderboard = sortedUsers.slice(0, 10).map((user, index) => {
        const userData = topUsers.find(u => u.id === user.userId);
        return {
          rank: index + 1,
          username: userData?.username || 'Anonymous',
          score: Math.round(user.totalScore),
          isCurrentUser: user.userId === userId,
        };
      });
    }
  }

  return {
    dailyRank: userRankIndex >= 0 ? userRankIndex + 1 : null,
    topScoreToday: topScore,
    todaysAverage: averageScore,
    userScoreToday: userStats?.totalScore ?? null,
    calibrationToday: cumulativeCalibration,
    totalParticipantsToday: totalParticipants,
    todayLeaderboard,
  };
}

/**
 * Get performance history for past N days
 * Calibration is shown as cumulative (all-time) up to each day for robust measurement
 */
export async function getPerformanceHistory(
  userId: string,
  days: number = 7
): Promise<Array<{
  date: string;
  day: string;
  userScore: number;
  avgScore: number;
  calibration: number;
}>> {
  const dayNames = ['Su', 'M', 'T', 'W', 'Th', 'F', 'S'];
  const result: Array<{
    date: string;
    day: string;
    userScore: number;
    avgScore: number;
    calibration: number;
  }> = [];

  const endDate = new Date();
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

  const startDateStr = getPacificDayStart(startDate);

  // Fetch responses from the display window for daily scores
  const { data: recentResponses, error: recentError } = await supabase
    .from('user_responses')
    .select('user_id, score, captured, answered_at')
    .gte('answered_at', startDateStr);

  if (recentError) {
    console.error('Failed to fetch performance history:', recentError);
    return [];
  }

  // Fetch ALL responses for this user to calculate cumulative calibration
  const { data: allUserResponses, error: allUserError } = await supabase
    .from('user_responses')
    .select('captured, answered_at')
    .eq('user_id', userId)
    .order('answered_at', { ascending: true });

  if (allUserError) {
    console.error('Failed to fetch all user responses:', allUserError);
    return [];
  }

  // Build daily stats for all users (for avgScore calculation)
  const dateUserStats: Map<string, Map<string, { score: number; captured: number; total: number }>> = new Map();

  for (const response of recentResponses || []) {
    const dateStr = getPacificDateString(new Date(response.answered_at));

    if (!dateUserStats.has(dateStr)) {
      dateUserStats.set(dateStr, new Map());
    }

    const dayStats = dateUserStats.get(dateStr)!;
    const userStats = dayStats.get(response.user_id) || { score: 0, captured: 0, total: 0 };
    userStats.score += Number(response.score);
    userStats.captured += response.captured ? 1 : 0;
    userStats.total += 1;
    dayStats.set(response.user_id, userStats);
  }

  // Calculate cumulative calibration for the user up to end of each day
  // Map: dateStr -> { cumulativeCaptured, cumulativeTotal }
  const cumulativeByDate: Map<string, { captured: number; total: number }> = new Map();
  let runningCaptured = 0;
  let runningTotal = 0;

  for (const response of allUserResponses || []) {
    runningCaptured += response.captured ? 1 : 0;
    runningTotal += 1;
    const dateStr = getPacificDateString(new Date(response.answered_at));
    cumulativeByDate.set(dateStr, { captured: runningCaptured, total: runningTotal });
  }

  // Track the last known cumulative values for days with no activity
  let lastKnownCaptured = 0;
  let lastKnownTotal = 0;

  // Find cumulative stats before the display window starts
  for (const response of allUserResponses || []) {
    const responseDate = new Date(response.answered_at);
    if (responseDate < startDate) {
      lastKnownCaptured += response.captured ? 1 : 0;
      lastKnownTotal += 1;
    }
  }

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + i);
    const dateStr = getPacificDateString(date);
    const dayOfWeek = date.getUTCDay();

    const dayStats = dateUserStats.get(dateStr);

    // Get cumulative calibration up to this date
    const cumulative = cumulativeByDate.get(dateStr);
    if (cumulative) {
      lastKnownCaptured = cumulative.captured;
      lastKnownTotal = cumulative.total;
    }

    const cumulativeCalibration = lastKnownTotal > 0
      ? (lastKnownCaptured / lastKnownTotal) * 100
      : 0;

    if (!dayStats || dayStats.size === 0) {
      result.push({
        date: dateStr,
        day: dayNames[dayOfWeek],
        userScore: 0,
        avgScore: 0,
        calibration: cumulativeCalibration,
      });
      continue;
    }

    const allUserScores = Array.from(dayStats.values()).map(s => s.score);
    const avgScore = allUserScores.reduce((a, b) => a + b, 0) / allUserScores.length;

    const userDayStats = dayStats.get(userId);
    const userScore = userDayStats?.score ?? 0;

    result.push({
      date: dateStr,
      day: dayNames[dayOfWeek],
      userScore,
      avgScore,
      calibration: cumulativeCalibration,
    });
  }

  return result;
}

/**
 * Get calibration milestones showing the user's calibration journey from first play to now.
 * Returns 6 evenly-spaced milestone points (or fewer if user has < 6 unique play dates).
 */
export async function getCalibrationMilestones(userId: string): Promise<Array<{
  date: string;
  label: string;
  calibration: number;
}>> {
  // Fetch all user responses ordered chronologically
  const { data: allUserResponses, error: allUserError } = await supabase
    .from('user_responses')
    .select('captured, answered_at')
    .eq('user_id', userId)
    .order('answered_at', { ascending: true });

  if (allUserError) {
    console.error('Failed to fetch user responses for calibration milestones:', allUserError);
    return [];
  }

  if (!allUserResponses || allUserResponses.length === 0) {
    return [];
  }

  // Build cumulative calibration per unique play date
  const dateCalibration: Map<string, { cumulativeCaptured: number; cumulativeTotal: number }> = new Map();
  let runningCaptured = 0;
  let runningTotal = 0;

  for (const response of allUserResponses) {
    runningCaptured += response.captured ? 1 : 0;
    runningTotal += 1;
    const dateStr = getPacificDateString(new Date(response.answered_at));
    dateCalibration.set(dateStr, {
      cumulativeCaptured: runningCaptured,
      cumulativeTotal: runningTotal,
    });
  }

  // Get sorted list of unique play dates
  const playDates = Array.from(dateCalibration.keys());

  if (playDates.length < 2) {
    // Not enough data for a trend
    return [];
  }

  // Helper to format date as MM/DD
  const formatLabel = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00.000Z');
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return `${month}/${day}`;
  };

  // Helper to get calibration percentage for a date
  const getCalibration = (dateStr: string): number => {
    const data = dateCalibration.get(dateStr);
    if (!data || data.cumulativeTotal === 0) return 0;
    return (data.cumulativeCaptured / data.cumulativeTotal) * 100;
  };

  // If 2-5 unique play dates, return all of them
  if (playDates.length <= 5) {
    return playDates.map(dateStr => ({
      date: dateStr,
      label: formatLabel(dateStr),
      calibration: getCalibration(dateStr),
    }));
  }

  // For 6+ dates, select 6 milestone points
  const firstDate = playDates[0];
  const lastDate = playDates[playDates.length - 1];
  const firstTime = new Date(firstDate + 'T00:00:00.000Z').getTime();
  const lastTime = new Date(lastDate + 'T00:00:00.000Z').getTime();
  const timeSpan = lastTime - firstTime;

  // Find closest play date to a target timestamp
  const findClosestPlayDate = (targetTime: number): string => {
    let closestDate = playDates[0];
    let closestDiff = Infinity;

    for (const dateStr of playDates) {
      const dateTime = new Date(dateStr + 'T00:00:00.000Z').getTime();
      const diff = Math.abs(dateTime - targetTime);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestDate = dateStr;
      }
    }

    return closestDate;
  };

  // Calculate 6 milestone dates (first, 4 intermediate, last)
  const milestones: string[] = [firstDate];

  for (let i = 1; i <= 4; i++) {
    const targetTime = firstTime + (timeSpan * i) / 5;
    const closestDate = findClosestPlayDate(targetTime);
    // Avoid duplicates
    if (!milestones.includes(closestDate)) {
      milestones.push(closestDate);
    }
  }

  // Add last date if not already included
  if (!milestones.includes(lastDate)) {
    milestones.push(lastDate);
  }

  // Sort milestones chronologically
  milestones.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return milestones.map(dateStr => ({
    date: dateStr,
    label: formatLabel(dateStr),
    calibration: getCalibration(dateStr),
  }));
}

/**
 * Get overall leaderboard showing top performers by total score
 */
export async function getOverallLeaderboard(
  userId: string,
  limit: number = 10
): Promise<Array<{
  rank: number;
  displayName: string;
  totalScore: number;
  gamesPlayed: number;
  isCurrentUser?: boolean;
}>> {
  console.log(`[getOverallLeaderboard] Fetching leaderboard for userId=${userId}, limit=${limit}`);

  const { data: topUsers, error } = await supabase
    .from('users')
    .select('id, username, total_score, games_played')
    .gt('games_played', 0)
    .order('total_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getOverallLeaderboard] Failed to fetch overall leaderboard:', error.message, error.details);
    return [];
  }

  console.log(`[getOverallLeaderboard] Query returned ${topUsers?.length || 0} users:`, JSON.stringify(topUsers));

  if (!topUsers || topUsers.length === 0) {
    console.log('[getOverallLeaderboard] No users with games_played > 0 found');
    return [];
  }

  return topUsers.map((user, index) => ({
    rank: index + 1,
    displayName: user.username,
    totalScore: Math.round(Number(user.total_score)),
    gamesPlayed: user.games_played,
    isCurrentUser: user.id === userId,
  }));
}

/**
 * Get user's overall standing (percentile and total players)
 */
export async function getOverallStanding(
  userId: string
): Promise<{
  percentile: number;
  totalPlayers: number;
} | null> {
  // Get total number of users who have played at least one game
  const { count: totalPlayers, error: countError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .gt('games_played', 0);

  if (countError || totalPlayers === null || totalPlayers === 0) {
    console.error('Failed to count total players:', countError);
    return null;
  }

  // Get current user's score
  const { data: currentUser, error: userError } = await supabase
    .from('users')
    .select('total_score')
    .eq('id', userId)
    .single();

  if (userError || !currentUser) {
    console.error('Failed to fetch current user:', userError);
    return null;
  }

  // Count how many users have a higher score
  const { count: usersAbove, error: rankError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .gt('total_score', currentUser.total_score)
    .gt('games_played', 0);

  if (rankError || usersAbove === null) {
    console.error('Failed to calculate ranking:', rankError);
    return null;
  }

  // Calculate percentile (what % of users this user is better than)
  const percentile = totalPlayers > 1
    ? ((totalPlayers - usersAbove - 1) / totalPlayers) * 100
    : 100;

  return {
    percentile: Math.max(0, Math.min(100, percentile)), // Clamp between 0-100
    totalPlayers,
  };
}

/**
 * Get crowd data for a specific question
 * Returns distribution of other players' guesses for visualization
 */
export async function getCrowdDataForQuestion(
  questionId: string,
  trueValue: number,
  excludeUserId?: string
): Promise<CrowdData | null> {
  // Query user_responses for this question, excluding the current user
  let query = supabase
    .from('user_responses')
    .select('lower_bound, upper_bound, captured')
    .eq('question_id', questionId)
    .order('answered_at', { ascending: false })
    .limit(60);

  if (excludeUserId) {
    query = query.neq('user_id', excludeUserId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch crowd data:', error);
    return null;
  }

  // Need at least 1 response to show crowd data
  if (!data || data.length < 1) {
    return null;
  }

  // Build guesses array
  const guesses = data.map(r => ({
    min: Number(r.lower_bound),
    max: Number(r.upper_bound),
  }));

  // Calculate median lower and upper bounds
  const lowerBounds = guesses.map(g => g.min).sort((a, b) => a - b);
  const upperBounds = guesses.map(g => g.max).sort((a, b) => a - b);
  const midIdx = Math.floor(data.length / 2);

  const avgMin = data.length % 2 === 0
    ? (lowerBounds[midIdx - 1] + lowerBounds[midIdx]) / 2
    : lowerBounds[midIdx];

  const avgMax = data.length % 2 === 0
    ? (upperBounds[midIdx - 1] + upperBounds[midIdx]) / 2
    : upperBounds[midIdx];

  // Check if average bounds would capture the true value
  const avgHit = trueValue >= avgMin && trueValue <= avgMax;

  // Calculate hit rate from captured column
  const hitCount = data.filter(r => r.captured).length;
  const hitRate = hitCount / data.length;

  return {
    guesses,
    avgMin,
    avgMax,
    avgHit,
    hitRate,
    totalResponses: data.length,
  };
}
