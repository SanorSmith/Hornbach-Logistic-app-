// Runs under the frontend's Vitest (see frontend/vitest.config.ts); deactivate.ts
// has no Deno-only runtime imports, so it loads in Node as well.
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { BAN_DURATION, deactivateUser } from './deactivate.ts';

function fakeAdmin({ updateError = null, banError = null }: { updateError?: unknown; banError?: unknown } = {}) {
  const eq = vi.fn().mockResolvedValue({ error: updateError });
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  const updateUserById = vi.fn().mockResolvedValue({ data: null, error: banError });
  const admin = { from, auth: { admin: { updateUserById } } } as unknown as SupabaseClient;
  return { admin, from, update, eq, updateUserById };
}

describe('deactivateUser', () => {
  it('deactivates the profile and bans the login', async () => {
    const f = fakeAdmin();
    expect(await deactivateUser(f.admin, 'u1')).toBeNull();
    expect(f.from).toHaveBeenCalledWith('users');
    expect(f.update).toHaveBeenCalledWith({ is_active: false });
    expect(f.eq).toHaveBeenCalledWith('id', 'u1');
    expect(f.updateUserById).toHaveBeenCalledWith('u1', { ban_duration: BAN_DURATION });
  });

  it('reports a failed deactivation and does not go on to ban', async () => {
    const f = fakeAdmin({ updateError: { message: 'permission denied' } });
    expect(await deactivateUser(f.admin, 'u1')).toEqual({
      context: 'deactivate user',
      error: { message: 'permission denied' },
    });
    expect(f.updateUserById).not.toHaveBeenCalled();
  });

  it('reports a failed ban instead of claiming success', async () => {
    const f = fakeAdmin({ banError: { message: 'User not allowed' } });
    expect(await deactivateUser(f.admin, 'u1')).toEqual({
      context: 'ban user',
      error: { message: 'User not allowed' },
    });
  });
});
