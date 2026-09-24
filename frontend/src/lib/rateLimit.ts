import { supabase } from './supabase';
import { PointStatus } from '../types';

// Mirrors supabase/migrations/20260924170000_status_rate_limit.sql: non-admin
// users may make at most 2 changes to UPPTAGEN or from SKRAP to LEDIG per
// rolling 2 minutes. The database enforces it; the app only shows a countdown.

export const RATE_LIMIT_MESSAGE = 'Max 2 ändringar till Upptagen eller från Skräp till Ledig per 2 minuter.';

export function isLimitedChange(from: PointStatus, to: PointStatus) {
  return from !== to && (to === 'UPPTAGEN' || (from === 'SKRAP' && to === 'LEDIG'));
}

/** Seconds the current user must wait before the next limited change (0 = allowed). */
export async function getLimitedChangeWait(): Promise<number> {
  const { data, error } = await supabase.rpc('limited_change_wait_seconds' as never);
  if (error) {
    console.error('Error checking rate limit:', error);
    return 0; // the database still enforces the limit
  }
  return Number(data) || 0;
}

/** Wait time in seconds if `error` is the database's rate-limit error, otherwise null. */
export function rateLimitSeconds(error: unknown): number | null {
  const message = (error as { message?: string } | null)?.message ?? '';
  const match = message.match(/RATE_LIMIT:(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
