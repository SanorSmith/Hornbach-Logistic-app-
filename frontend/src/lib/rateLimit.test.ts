import { describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('./supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import { getLimitedChangeWait, isLimitedChange, rateLimitSeconds } from './rateLimit';

describe('isLimitedChange (mirrors the database rule)', () => {
  it('limits every change to Upptagen', () => {
    expect(isLimitedChange('LEDIG', 'UPPTAGEN')).toBe(true);
    expect(isLimitedChange('SKRAP', 'UPPTAGEN')).toBe(true);
  });

  it('limits Skräp to Ledig', () => {
    expect(isLimitedChange('SKRAP', 'LEDIG')).toBe(true);
  });

  it('does not limit other changes or no-op changes', () => {
    expect(isLimitedChange('UPPTAGEN', 'LEDIG')).toBe(false);
    expect(isLimitedChange('LEDIG', 'SKRAP')).toBe(false);
    expect(isLimitedChange('KUNDORDER', 'LEDIG')).toBe(false);
    expect(isLimitedChange('UPPTAGEN', 'UPPTAGEN')).toBe(false);
  });
});

describe('rateLimitSeconds', () => {
  it('reads the wait time from the database error', () => {
    expect(rateLimitSeconds({ message: 'RATE_LIMIT:87' })).toBe(87);
  });

  it('returns null for other errors', () => {
    expect(rateLimitSeconds({ message: 'permission denied' })).toBeNull();
    expect(rateLimitSeconds(null)).toBeNull();
    expect(rateLimitSeconds(undefined)).toBeNull();
  });
});

describe('getLimitedChangeWait', () => {
  it('returns the seconds from the database', async () => {
    rpc.mockResolvedValueOnce({ data: 42, error: null });
    await expect(getLimitedChangeWait()).resolves.toBe(42);
    expect(rpc).toHaveBeenCalledWith('limited_change_wait_seconds');
  });

  it('returns 0 when the check fails (the database still enforces the limit)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
    await expect(getLimitedChangeWait()).resolves.toBe(0);
  });
});
