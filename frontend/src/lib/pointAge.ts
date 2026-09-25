import { useEffect, useState } from 'react';
import { RedPoint } from '../types';

// How long a point has had its current status, used to sort Upptagen points
// oldest first and to flag the ones that have been busy too long.

export const OVERDUE_HOURS = 24;
const HOUR = 60 * 60 * 1000;

export function statusSince(point: RedPoint): Date {
  return new Date(point.status_changed_at ?? point.last_updated);
}

export function isOverdue(point: RedPoint, now: number): boolean {
  return point.status === 'UPPTAGEN' && now - statusSince(point).getTime() > OVERDUE_HOURS * HOUR;
}

/** "45 min", "3 h 20 min", "2 d 5 h" */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${mins} min`;
  return `${mins} min`;
}

const PRIORITY: Record<RedPoint['status'], number> = { KUNDORDER: 0, SKRAP: 1, UPPTAGEN: 2, LEDIG: 3 };

/** Kundorder, Skräp, Upptagen (oldest first), Ledig. */
export function sortPointsForDisplay(points: RedPoint[]): RedPoint[] {
  return [...points].sort((a, b) => {
    const byStatus = PRIORITY[a.status] - PRIORITY[b.status];
    if (byStatus !== 0) return byStatus;
    if (a.status === 'UPPTAGEN') return statusSince(a).getTime() - statusSince(b).getTime();
    return a.point_number - b.point_number;
  });
}

// Natural order for point names: T1, T2, ... T10 (not T1, T10, T2).
const nameCollator = new Intl.Collator('sv', { numeric: true, sensitivity: 'base' });

export function comparePointNames(a: string, b: string): number {
  return nameCollator.compare(a.trim(), b.trim());
}

/**
 * Points in ascending order of their name in the avdelning (T1, T2 ... T15);
 * points without a name come last, by point number.
 */
export function sortPointsByName(points: RedPoint[], names: Record<string, string>): RedPoint[] {
  return [...points].sort((a, b) => {
    const nameA = names[a.id]?.trim();
    const nameB = names[b.id]?.trim();
    if (nameA && nameB) return comparePointNames(nameA, nameB) || a.point_number - b.point_number;
    if (nameA) return -1;
    if (nameB) return 1;
    return a.point_number - b.point_number;
  });
}

/** Current time, refreshed every minute so durations and 24 h flags stay live. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
