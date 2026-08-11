import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * PGRST116 = `.single()` matched no rows — an expected miss, not a failure.
 * Any other error (network down, bad credentials, RLS) is a real problem
 * and should be thrown, not treated as "not found".
 */
export function isNoRowsError(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST116';
}
