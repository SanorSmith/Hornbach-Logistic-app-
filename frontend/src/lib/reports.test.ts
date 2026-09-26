import { describe, expect, it } from 'vitest';
import { fillSeries, getPeriod, pointRows, shiftPeriod, ReportData, Counts } from './reports';

const zero: Counts = {
  events: 0,
  pallets_placed: 0,
  pallets_picked: 0,
  skrap_reported: 0,
  skrap_removed: 0,
  kundorder_reported: 0,
  kundorder_picked: 0,
  extra_pallets_placed: 0,
  allowances_granted: 0,
};

describe('getPeriod', () => {
  const anchor = new Date(2026, 8, 24, 15, 30); // Thu 24 Sep 2026

  it('builds an ISO week (Monday to Monday)', () => {
    const week = getPeriod('week', anchor);
    expect(week.from).toEqual(new Date(2026, 8, 21));
    expect(week.to).toEqual(new Date(2026, 8, 28));
    expect(week.bucket).toBe('day');
    expect(week.label).toMatch(/^Vecka 39, 2026/);
  });

  it('builds a month with a Swedish, capitalised label', () => {
    const month = getPeriod('month', anchor);
    expect(month.from).toEqual(new Date(2026, 8, 1));
    expect(month.to).toEqual(new Date(2026, 9, 1));
    expect(month.label).toBe('September 2026');
  });

  it('builds a year bucketed by month', () => {
    const year = getPeriod('year', anchor);
    expect(year.from).toEqual(new Date(2026, 0, 1));
    expect(year.to).toEqual(new Date(2027, 0, 1));
    expect(year.bucket).toBe('month');
  });
});

describe('shiftPeriod', () => {
  it('moves one period back or forward', () => {
    const month = getPeriod('month', new Date(2026, 0, 15));
    expect(shiftPeriod(month, -1)).toEqual(new Date(2025, 11, 1));
    const week = getPeriod('week', new Date(2026, 8, 24));
    expect(shiftPeriod(week, 1)).toEqual(new Date(2026, 8, 28));
  });
});

describe('fillSeries', () => {
  it('returns every day of the week, with zeros for empty days', () => {
    const week = getPeriod('week', new Date(2026, 8, 24));
    const series = fillSeries(week, [{ bucket: '2026-09-23', ...zero, events: 5, pallets_placed: 3 }]);
    expect(series).toHaveLength(7);
    expect(series[2]).toMatchObject({ bucket: '2026-09-23', events: 5, pallets_placed: 3 });
    expect(series[0]).toMatchObject({ bucket: '2026-09-21', events: 0 });
  });

  it('returns 12 months for a year', () => {
    expect(fillSeries(getPeriod('year', new Date(2026, 5, 1)), [])).toHaveLength(12);
  });
});

describe('pointRows', () => {
  it('names points by their avdelning number and sorts them naturally', () => {
    const report = {
      by_point: [
        { id: '1', point_number: 48, name: 'T11', department: 'Trädgård ', ...zero, events: 21 },
        { id: '2', point_number: 38, name: 'T1', department: 'Zoo', ...zero, events: 5 },
        { id: '3', point_number: 59, name: null, department: 'GM', ...zero, events: 9 },
        { id: '4', point_number: 40, name: 'T3', department: 'Trädgård', ...zero, events: 17 },
      ],
    } as unknown as ReportData;

    const rows = pointRows(report);
    expect(rows.map((r) => r.name)).toEqual(['Punkt 59', 'T1', 'T3', 'T11']);
    expect(rows[3].detail).toBe('#48 · Trädgård');
  });
});
