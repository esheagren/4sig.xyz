import { supabase, isNoRowsError } from './supabase.js';
import { User } from './types.js';
import { rowToUser, getUserById } from './auth.js';

// Username validation regex: 3-20 chars, alphanumeric + underscore
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

/**
 * Validate username format
 */
export function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username);
}

/**
 * Get or create an anonymous user by device ID
 */
export async function getOrCreateDeviceUser(deviceId: string): Promise<User> {
  // First try to find existing user with this device ID
  const { data: existingUser, error: findError } = await supabase
    .from('users')
    .select('*')
    .eq('device_id', deviceId)
    .single();

  if (existingUser && !findError) {
    return rowToUser(existingUser);
  }

  // Only fall through to creation when the lookup genuinely found no rows —
  // a connection/credentials failure here must not spawn a duplicate user
  if (findError && !isNoRowsError(findError)) {
    throw new Error(`Failed to look up user: ${findError.message}`);
  }

  // Create new anonymous user
  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert({
      device_id: deviceId,
      username: 'Guest Player',
      is_anonymous: true,
    })
    .select()
    .single();

  if (createError) {
    throw new Error(`Failed to create user: ${createError.message}`);
  }

  return rowToUser(newUser);
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error && !isNoRowsError(error)) {
    throw new Error(`Failed to look up user by email: ${error.message}`);
  }

  if (error || !data) {
    return null;
  }

  return rowToUser(data);
}

/**
 * Convert anonymous user to authenticated user (with email)
 */
export async function convertToAuthenticatedUser(
  userId: string,
  authId: string,
  email: string,
  username: string
): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update({
      auth_id: authId,
      email: email,
      username: username,
      is_anonymous: false,
      email_verified: true,
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to convert user: ${error.message}`);
  }

  return rowToUser(data);
}

/**
 * Create a new authenticated user (with email)
 */
export async function createAuthenticatedUser(
  authId: string,
  email: string,
  username: string,
  deviceId?: string
): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .insert({
      auth_id: authId,
      email: email,
      username: username,
      device_id: deviceId || null,
      is_anonymous: false,
      email_verified: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }

  return rowToUser(data);
}

/**
 * Link a device to an authenticated user
 */
export async function linkDeviceToUser(userId: string, deviceId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ device_id: deviceId })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to link device: ${error.message}`);
  }
}

/**
 * Merge anonymous user data into authenticated user
 */
export async function mergeUsers(anonymousUserId: string, authenticatedUserId: string): Promise<void> {
  const { error } = await supabase.rpc('merge_anonymous_user', {
    p_anonymous_user_id: anonymousUserId,
    p_authenticated_user_id: authenticatedUserId,
  });

  if (error) {
    throw new Error(`Failed to merge users: ${error.message}`);
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: { username?: string; timezone?: string; themePreference?: string }
): Promise<User> {
  const updateData: any = {};
  if (updates.username !== undefined) {
    updateData.username = updates.username;
  }
  if (updates.timezone !== undefined) {
    updateData.timezone = updates.timezone;
  }
  if (updates.themePreference !== undefined) {
    updateData.theme_preference = updates.themePreference;
  }

  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  }

  return rowToUser(data);
}

/**
 * Get user stats with additional computed fields
 */
export async function getUserStats(userId: string): Promise<{
  user: User;
  recentGames: any[];
} | null> {
  const user = await getUserById(userId);
  if (!user) {
    return null;
  }

  // Get recent games
  const { data: recentGames } = await supabase
    .from('user_responses')
    .select(`
      id,
      score,
      captured,
      answered_at,
      question:questions(question_text)
    `)
    .eq('user_id', userId)
    .order('answered_at', { ascending: false })
    .limit(10);

  return {
    user,
    recentGames: recentGames || [],
  };
}

/**
 * Get user by username (case-insensitive)
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('username', username)
    .neq('username', 'Guest Player')
    .single();

  // A real failure here must throw: returning null would make
  // isUsernameAvailable() report every name as available during an outage
  if (error && !isNoRowsError(error)) {
    throw new Error(`Failed to look up username: ${error.message}`);
  }

  if (error || !data) {
    return null;
  }

  return rowToUser(data);
}

/**
 * Check if a username is available (case-insensitive)
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const existing = await getUserByUsername(username);
  return existing === null;
}

/**
 * Generate username suggestions based on a taken username
 */
export function generateUsernameSuggestions(baseUsername: string): string[] {
  const suggestions: string[] = [];
  const random = Math.floor(Math.random() * 1000);

  suggestions.push(`${baseUsername}${random}`);
  suggestions.push(`${baseUsername}_${random}`);
  suggestions.push(`${baseUsername}${Math.floor(Math.random() * 100)}`);

  return suggestions;
}

/**
 * Set username for a device user (converts from anonymous to username-only)
 * This is for username-only signup (no email/password)
 */
export async function setUsernameForDevice(
  deviceId: string,
  username: string
): Promise<User> {
  // First, get or create the device user
  const existingUser = await getOrCreateDeviceUser(deviceId);

  // Update the user with the username and mark as non-anonymous
  const { data, error } = await supabase
    .from('users')
    .update({
      username: username,
      is_anonymous: false,
    })
    .eq('id', existingUser.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to set username: ${error.message}`);
  }

  return rowToUser(data);
}

/**
 * Link email to a username-only user (creates Supabase auth)
 * This upgrades a username-only account to a full account with email
 */
export async function linkEmailToUser(
  userId: string,
  authId: string,
  email: string
): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update({
      auth_id: authId,
      email: email,
      email_verified: true,
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to link email: ${error.message}`);
  }

  return rowToUser(data);
}
