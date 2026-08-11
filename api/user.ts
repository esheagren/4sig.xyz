import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthUser, getUserById } from './_lib/auth.js';
import { getUserStats, updateUserProfile } from './_lib/users.js';
import { getDailyStats, getPerformanceHistory } from './_lib/sessions.js';

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const path = req.url?.split('?')[0] || '';
  const action = path.replace('/api/user', '').replace('/', '');

  const authUser = await getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'User identification required. Send X-Device-Id header or Bearer token.' });
  }

  try {
    // `return await` (not bare `return`) so rejections from the handlers
    // are caught below instead of crashing the function invocation
    switch (action) {
      case 'profile':
        return await handleProfile(req, res, authUser.userId);
      case 'stats':
        return await handleStats(req, res, authUser.userId);
      case 'daily-stats':
        return await handleDailyStats(req, res, authUser.userId);
      case 'performance-history':
        return await handlePerformanceHistory(req, res, authUser.userId);
      default:
        return res.status(404).json({ error: 'Not found' });
    }
  } catch (err) {
    console.error('User error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleProfile(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method === 'GET') {
    const stats = await getUserStats(userId);
    if (!stats) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: {
        id: stats.user.id,
        email: stats.user.email,
        displayName: stats.user.username,
        isAnonymous: stats.user.isAnonymous,
        createdAt: stats.user.createdAt,
        lastPlayedAt: stats.user.lastPlayedAt,
        themePreference: stats.user.themePreference,
      },
      stats: {
        totalScore: stats.user.totalScore,
        averageScore: stats.user.averageScore,
        gamesPlayed: stats.user.gamesPlayed,
        questionsCaptured: stats.user.questionsCaptured,
        calibrationRate: stats.user.calibrationRate,
        currentStreak: stats.user.currentStreak,
        bestStreak: stats.user.bestStreak,
        bestSingleScore: stats.user.bestSingleScore,
        weeklyScore: stats.user.weeklyScore,
      },
      recentGames: stats.recentGames.map((game: any) => ({
        id: game.id,
        score: Number(game.score),
        captured: game.captured,
        answeredAt: game.answered_at,
        questionText: game.question?.question_text,
      })),
      categoryStats: stats.categoryStats.map((cat: any) => ({
        subcategoryName: cat.subcategory?.name,
        categoryName: cat.subcategory?.category?.name,
        domainName: cat.subcategory?.category?.domain?.name,
        questionsAnswered: cat.questions_answered,
        totalScore: Number(cat.total_score),
        averageScore: Number(cat.average_score),
        calibrationRate: Number(cat.calibration_rate),
      })),
    });
  }

  if (req.method === 'PATCH') {
    const { displayName, timezone, themePreference } = req.body;

    if (displayName !== undefined) {
      if (typeof displayName !== 'string' || displayName.trim().length < 1) {
        return res.status(400).json({ error: 'Display name must be at least 1 character' });
      }
      if (displayName.length > 50) {
        return res.status(400).json({ error: 'Display name must be 50 characters or less' });
      }
    }

    const user = await updateUserProfile(userId, {
      displayName: displayName?.trim(),
      timezone,
      themePreference,
    });

    return res.json({
      user: {
        id: user.id,
        displayName: user.username,
        timezone: user.timezone,
        themePreference: user.themePreference,
      },
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleStats(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    stats: {
      totalScore: user.totalScore,
      averageScore: user.averageScore,
      gamesPlayed: user.gamesPlayed,
      questionsCaptured: user.questionsCaptured,
      calibrationRate: user.calibrationRate,
      currentStreak: user.currentStreak,
      bestStreak: user.bestStreak,
      bestSingleScore: user.bestSingleScore,
      weeklyScore: user.weeklyScore,
    },
  });
}

async function handleDailyStats(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const dailyStats = await getDailyStats(userId);
  return res.json(dailyStats);
}

async function handlePerformanceHistory(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const days = parseInt(req.query.days as string) || 7;
  const maxDays = 30;
  const history = await getPerformanceHistory(userId, Math.min(days, maxDays));
  return res.json({ history });
}
