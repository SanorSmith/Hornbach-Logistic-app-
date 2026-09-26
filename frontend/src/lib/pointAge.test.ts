import { describe, expect, it } from 'vitest';
import { comparePointNames, formatDuration, isOverdue, sortPointsByName, sortPointsForDisplay, statusSince } from './pointAge';
import { HOUR, makePoint } from '../test/fixtures';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * HOUR).toISOString();

describe('statusSince', () => {
  it('uses status_changed_at, falling back to last_updated', () => {
    const point = makePoint({ status_changed_at: hoursAgo(5), last_updated: hoursAgo(1) });
    expect(statusSince(point).getTime()).toBe(NOW - 5 * HOUR);
    const legacy = makePoint({ status_changed_at: undefined, last_updated: hoursAgo(2) });
    expect(statusSince(legacy).getTime()).toBe(NOW - 2 * HOUR);
  });
});

describe('isOverdue', () => {
  it('flags Upptagen points older than 24 hours', () => {
    expect(isOverdue(makePoint({ status: 'UPPTAGEN', status_changed_at: hoursAgo(25) }), NOW)).toBe(true);
    expect(isOverdue(makePoint({ status: 'UPPTAGEN', status_changed_at: hoursAgo(23) }), NOW)).toBe(false);
  });

  it('never flags other statuses', () => {
    for (const status of ['LEDIG', 'SKRAP', 'KUNDORDER'] as const) {
      expect(isOverdue(makePoint({ status, status_changed_at: hoursAgo(100) }), NOW)).toBe(false);
    }
  });
});

describe('formatDuration', () => {
  it('formats minutes, hours and days', () => {
    expect(formatDuration(45 * 60000)).toBe('45 min');
    expect(formatDuration(3 * HOUR + 20 * 60000)).toBe('3 h 20 min');
    expect(formatDuration(53 * HOUR)).toBe('2 d 5 h');
  });

  it('never shows negative durations', () => {
    expect(formatDuration(-5000)).toBe('0 min');
  });
});

describe('sortPointsForDisplay', () => {
  it('orders Kundorder, Skräp, Upptagen (oldest first), Ledig', () => {
    const ledig = makePoint({ status: 'LEDIG', point_number: 1 });
    const newBusy = makePoint({ status: 'UPPTAGEN', status_changed_at: hoursAgo(1) });
    const oldBusy = makePoint({ status: 'UPPTAGEN', status_changed_at: hoursAgo(30) });
    const skrap = makePoint({ status: 'SKRAP' });
    const kundorder = makePoint({ status: 'KUNDORDER' });

    const sorted = sortPointsForDisplay([ledig, newBusy, skrap, oldBusy, kundorder]);
    expect(sorted).toEqual([kundorder, skrap, oldBusy, newBusy, ledig]);
  });

  it('does not change the input array', () => {
    const input = [makePoint({ status: 'LEDIG' }), makePoint({ status: 'KUNDORDER' })];
    const copy = [...input];
    sortPointsForDisplay(input);
    expect(input).toEqual(copy);
  });
});

describe('natural name order', () => {
  it('sorts T2 before T10', () => {
    const names = ['T10', 'T2', 'T1', 'B3', 't15'];
    expect([...names].sort(comparePointNames)).toEqual(['B3', 'T1', 'T2', 'T10', 't15']);
  });

  it('puts named points first, then unnamed ones by number', () => {
    const t10 = makePoint({ id: 'x10', point_number: 5 });
    const t2 = makePoint({ id: 'x2', point_number: 9 });
    const unnamedHigh = makePoint({ id: 'u1', point_number: 60 });
    const unnamedLow = makePoint({ id: 'u2', point_number: 59 });
    const sorted = sortPointsByName([unnamedHigh, t10, unnamedLow, t2], { x10: 'T10', x2: 'T2' });
    expect(sorted.map((p) => p.id)).toEqual(['x2', 'x10', 'u2', 'u1']);
  });
});
