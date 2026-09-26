import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { makePoint } from '../test/fixtures';

const mock = await vi.hoisted(async () => (await import('../test/supabaseMock')).createSupabaseMock());
vi.mock('../lib/supabase', () => ({ supabase: mock.supabase }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toast }));

import { useRedPoints } from './useRedPoints';
import { useRedPointsStore } from '../store/redPointsStore';

beforeEach(() => {
  mock.reset();
  toast.success.mockReset();
  toast.error.mockReset();
  useRedPointsStore.setState({ points: [], isLoading: true });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('useRedPoints', () => {
  it('loads the active points', async () => {
    const points = [makePoint(), makePoint()];
    mock.respond('red_points', { data: points });
    const { result } = renderHook(() => useRedPoints());
    await waitFor(() => expect(result.current.points).toHaveLength(2));
    expect(result.current.isLoading).toBe(false);
    expect(mock.calls).toContainEqual({ table: 'red_points', method: 'eq', args: ['is_active', true] });
  });

  it('updates only the status and reloads', async () => {
    mock.respond('red_points', { data: [] }); // initial load
    const { result } = renderHook(() => useRedPoints());
    mock.respond('red_points', { error: null }); // update
    mock.respond('red_points', { data: [] }); // reload

    let saved: boolean | null = null;
    await act(async () => {
      saved = await result.current.updatePointStatus('p1', 'SKRAP');
    });
    expect(saved).toBe(true);
    expect(mock.calls).toContainEqual({ table: 'red_points', method: 'update', args: [{ status: 'SKRAP' }] });
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows the countdown message when the database rate limit refuses', async () => {
    mock.respond('red_points', { data: [] });
    const { result } = renderHook(() => useRedPoints());
    mock.respond('red_points', { error: { message: 'RATE_LIMIT:75' } });

    let saved: boolean | null = true;
    await act(async () => {
      saved = await result.current.updatePointStatus('p1', 'UPPTAGEN');
    });
    expect(saved).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('75 s'), expect.anything());
  });

  it('cleans up its realtime channel on unmount', () => {
    mock.respond('red_points', { data: [] });
    const { unmount } = renderHook(() => useRedPoints());
    unmount();
    expect(mock.supabase.removeChannel).toHaveBeenCalled();
  });
});
