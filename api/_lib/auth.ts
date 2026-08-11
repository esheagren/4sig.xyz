import type { VercelRequest } from '@vercel/node';
import { supabase, isNoRowsError } from './supabase.js';
import { AuthUser, User } from './types.js';

// Helper to convert database row to User type
export function rowToUser(row: any): User {
  return {
    id: row.id,
    deviceId: row.device_id,
    authId: row.auth_id,
    email: row.email,
    username: row.username,
    isAnonymous: row.is_anonymous,
    emailVerified: row.email_verified ?? false,
    createdAt: new Date(row.created_at),
    lastPlayedAt: row.last_played_at ? new Date(row.last_played_at) : null,
    timezone: row.timezone,
    totalScore: Number(row.total_score),
    averageScore: Number(row.average_score),
    weeklyScore: Number(row.weekly_score),
    gamesPlayed: row.games_played,
    questionsCaptured: row.questions_captured,
    calibrationRate: Number(row.calibration_rate),
    currentStreak: row.current_streak,
    bestStreak: row.best_streak,
    bestSingleScore: Number(row.best_single_score),
    themePreference: row.theme_preference || 'default',
  };
}

/**
 * Extract device ID from request header
 */
export function extractDeviceId(req: VercelRequest): string | null {
  return (req.headers['x-device-id'] as string) || null;
}

/**
 * Extract and validate Supabase JWT from Authorization header
 */
export async function validateAuthToken(token: string): Promise<{ authId: string } | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return { authId: user.id };
  } catch (err) {
    console.error('Token validation error:', err);
    return null;
  }
}

/**
 * Get user by Supabase auth ID
 */
export async function getUserByAuthId(authId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', authId)
    .single();

  if (error && !isNoRowsError(error)) {
    throw new Error(`Failed to look up user by auth ID: ${error.message}`);
  }

  if (error || !data) {
    return null;
  }

  return rowToUser(data);
}

/**
 * Get user by device ID
 */
export async function getUserByDeviceId(deviceId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('device_id', deviceId)
    .single();

  if (error && !isNoRowsError(error)) {
    throw new Error(`Failed to look up user by device ID: ${error.message}`);
  }

  if (error || !data) {
    return null;
  }

  return rowToUser(data);
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && !isNoRowsError(error)) {
    throw new Error(`Failed to look up user by ID: ${error.message}`);
  }

  if (error || !data) {
    return null;
  }

  return rowToUser(data);
}

/**
 * Attach user to request - returns user info or null
 */
export async function getAuthUser(req: VercelRequest): Promise<AuthUser | null> {
  try {
    // Check for Bearer token first (authenticated user)
    const authHeader = req.headers.authorization;
    console.log(`[getAuthUser] Authorization header: ${authHeader ? 'present' : 'missing'}`);

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const validatedAuth = await validateAuthToken(token);
      console.log(`[getAuthUser] Token validation result:`, validatedAuth ? 'valid' : 'invalid');

      if (validatedAuth) {
        const user = await getUserByAuthId(validatedAuth.authId);
        console.log(`[getAuthUser] User by authId ${validatedAuth.authId}:`, user ? user.id : 'not found');
        if (user) {
          return {
            userId: user.id,
            authId: user.authId,
            isAnonymous: false,
          };
        }
      }
    }

    // Check for device ID (anonymous user)
    const deviceId = extractDeviceId(req);
    console.log(`[getAuthUser] Device ID from header: ${deviceId || 'missing'}`);

    if (deviceId) {
      const user = await getUserByDeviceId(deviceId);
      console.log(`[getAuthUser] User by deviceId ${deviceId}:`, user ? `found (id=${user.id}, username=${user.username})` : 'not found');
      if (user) {
        return {
          userId: user.id,
          authId: user.authId,
          isAnonymous: user.isAnonymous,
        };
      } else {
        console.log(`[getAuthUser] No user found for deviceId=${deviceId}. User may not have been created yet.`);
      }
    }

    console.log(`[getAuthUser] Returning null - no auth method succeeded`);
    return null;
  } catch (err) {
    console.error('[getAuthUser] Auth error:', err);
    return null;
  }
}
