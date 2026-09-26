// Fallback when a user can't be deleted because status history / notifications
// still reference them: keep the row for the audit trail, deactivate it and
// block sign-in. Both steps must succeed before the caller reports success,
// otherwise the admin would believe an account is blocked while it still works.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

// About 100 years: Supabase Auth has no permanent ban.
export const BAN_DURATION = '876000h';

export type DeactivateFailure = { context: string; error: { message?: string } };

/** Deactivates and bans a user. Returns the failed step, or null when both worked. */
export async function deactivateUser(admin: SupabaseClient, userId: string): Promise<DeactivateFailure | null> {
  const { error: updateError } = await admin.from('users').update({ is_active: false }).eq('id', userId);
  if (updateError) return { context: 'deactivate user', error: updateError };

  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: BAN_DURATION });
  if (banError) return { context: 'ban user', error: banError };

  return null;
}
