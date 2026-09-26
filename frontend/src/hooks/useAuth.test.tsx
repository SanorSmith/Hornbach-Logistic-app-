import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const mock = await vi.hoisted(async () => (await import('../test/supabaseMock')).createSupabaseMock());
vi.mock('../lib/supabase', () => ({ supabase: mock.supabase }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toast }));

import { useAuth } from './useAuth';
import { useAuthStore } from '../store/authStore';

const authUser = { id: 'u1', email: 'anna@hornbach.se' };
const profile = (extra: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'anna@hornbach.se',
  full_name: 'Anna',
  role: 'LINEFEEDER',
  is_active: true,
  facility: { id: 'f1', code: '772', name: 'Norsborg', is_active: true },
  ...extra,
});

beforeEach(() => {
  mock.reset();
  toast.error.mockReset();
  mock.supabase.auth.signOut.mockClear();
  mock.supabase.auth.signInWithPassword.mockReset().mockResolvedValue({ data: { user: authUser }, error: null });
  useAuthStore.setState({ user: null, supabaseUser: null, isLoading: false });
});

async function signIn() {
  const { result } = renderHook(() => useAuth());
  let returned: unknown;
  await act(async () => {
    returned = await result.current.signIn('anna@hornbach.se', 'secret');
  });
  return returned;
}

describe('useAuth.signIn', () => {
  it('signs in an active user of an open store', async () => {
    mock.respond('users', { data: profile() }); // profile
    mock.respond('users', { error: null }); // last_login update
    const user = await signIn();
    expect(user).toMatchObject({ full_name: 'Anna' });
    expect(useAuthStore.getState().user?.id).toBe('u1');
    expect(mock.calls).toContainEqual(expect.objectContaining({ table: 'users', method: 'update' }));
  });

  it('rejects wrong passwords', async () => {
    mock.supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid' } });
    expect(await signIn()).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Fel e-post eller lösenord');
  });

  it('rejects deactivated accounts and signs them out', async () => {
    mock.respond('users', { data: profile({ is_active: false }) });
    expect(await signIn()).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('inaktiverat'));
    expect(mock.supabase.auth.signOut).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('rejects users whose store is closed', async () => {
    mock.respond('users', { data: profile({ facility: null }) });
    expect(await signIn()).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Butiken är stängd'));
    expect(mock.supabase.auth.signOut).toHaveBeenCalled();
  });

  it('lets the super admin in without a store', async () => {
    mock.respond('users', { data: profile({ role: 'SUPER_ADMIN', facility: null }) });
    mock.respond('users', { error: null });
    expect(await signIn()).toMatchObject({ role: 'SUPER_ADMIN' });
  });

  it('rejects accounts without a profile', async () => {
    mock.respond('users', { data: null });
    expect(await signIn()).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('saknar användarprofil'));
  });
});
