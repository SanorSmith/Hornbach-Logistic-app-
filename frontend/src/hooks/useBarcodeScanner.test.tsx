import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBarcodeScanner } from './useBarcodeScanner';

// Fake timers also drive performance.now(), which the hook uses to tell a
// scanner (a few ms between keys) from a person (much slower).
const press = (key: string, gapMs = 5, target: EventTarget = window) => {
  vi.advanceTimersByTime(gapMs);
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
};
const type = (text: string, gapMs = 5) => [...text].forEach((ch) => press(ch, gapMs));

beforeEach(() => {
  vi.useFakeTimers();
  vi.advanceTimersByTime(1000);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useBarcodeScanner', () => {
  it('reports a fast burst ending with Enter as a scan', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner(onScan));
    type('RP-003');
    const enter = press('Enter');
    expect(onScan).toHaveBeenCalledWith('RP-003');
    expect(enter.defaultPrevented).toBe(true);
  });

  it('submits a burst without Enter once the scanner stops', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner(onScan));
    type('RP-012');
    vi.advanceTimersByTime(200);
    expect(onScan).toHaveBeenCalledWith('RP-012');
  });

  it('ignores slow human typing', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner(onScan));
    type('RP-003', 200);
    press('Enter', 200);
    vi.advanceTimersByTime(500);
    expect(onScan).not.toHaveBeenCalled();
  });

  it('ignores keys typed into a text field', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner(onScan));
    const input = document.createElement('input');
    document.body.appendChild(input);
    [...'RP-003'].forEach((ch) => press(ch, 5, input));
    press('Enter', 5, input);
    expect(onScan).not.toHaveBeenCalled();
    input.remove();
  });

  it('does nothing when disabled', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner(onScan, false));
    type('RP-003');
    press('Enter');
    expect(onScan).not.toHaveBeenCalled();
  });

  it('stops listening after unmount', () => {
    const onScan = vi.fn();
    const { unmount } = renderHook(() => useBarcodeScanner(onScan));
    unmount();
    type('RP-003');
    press('Enter');
    expect(onScan).not.toHaveBeenCalled();
  });
});
