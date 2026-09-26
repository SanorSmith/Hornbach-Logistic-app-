import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDeviceSetting } from './useDeviceSetting';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('useDeviceSetting', () => {
  it('remembers a choice for the next visit on this device', () => {
    const first = renderHook(() => useDeviceSetting('linefeeder.avdelning'));
    expect(first.result.current[0]).toBe('');
    act(() => first.result.current[1]('d-bygg'));
    expect(first.result.current[0]).toBe('d-bygg');

    const next = renderHook(() => useDeviceSetting('linefeeder.avdelning'));
    expect(next.result.current[0]).toBe('d-bygg');
  });

  it('forgets the choice when it is cleared', () => {
    const { result } = renderHook(() => useDeviceSetting('linefeeder.avdelning'));
    act(() => result.current[1]('d-bygg'));
    act(() => result.current[1](''));
    expect(localStorage.length).toBe(0);
  });

  it('still works when the browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const { result } = renderHook(() => useDeviceSetting('linefeeder.avdelning'));
    expect(result.current[0]).toBe('');
    act(() => result.current[1]('d-bygg'));
    expect(result.current[0]).toBe('d-bygg');
  });
});
