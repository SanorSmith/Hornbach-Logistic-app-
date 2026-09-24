import {
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfISOWeek,
  format,
  getISOWeek,
  getISOWeekYear,
  startOfISOWeek,
  startOfMonth,
  startOfYear,
  subDays,
} from 'date-fns';
import { sv } from 'date-fns/locale';
import { supabase } from './supabase';

// Reports are computed in the database from status_history, see
// supabase/migrations/20260924160000_reports.sql (get_report).

export const METRICS = [
  { key: 'pallets_placed', label: 'Pallar placerade', short: 'Placerade' },
  { key: 'pallets_picked', label: 'Pallar plockade', short: 'Plockade' },
  { key: 'skrap_reported', label: 'Skräp rapporterat', short: 'Skräp rapp.' },
  { key: 'skrap_removed', label: 'Skräp borttaget', short: 'Skräp bort' },
  { key: 'kundorder_reported', label: 'Kundorder', short: 'Kundorder' },
  { key: 'kundorder_picked', label: 'Kundorder hämtade', short: 'KO hämtade' },
] as const;

export type MetricKey = (typeof METRICS)[number]['key'];
export type Counts = Record<MetricKey | 'events', number>;

export interface ReportData {
  totals: Counts;
  series: (Counts & { bucket: string })[];
  by_department: (Counts & { id: string | null; name: string })[];
  by_user: (Counts & { id: string; name: string; role: string | null })[];
  by_point: (Counts & { id: string; point_number: number; name: string | null; department: string })[];
}

export type PeriodType = 'week' | 'month' | 'year';

export interface Period {
  type: PeriodType;
  from: Date; // inclusive
  to: Date; // exclusive
  label: string;
  bucket: 'day' | 'month';
}

export function getPeriod(type: PeriodType, anchor: Date): Period {
  if (type === 'week') {
    const from = startOfISOWeek(anchor);
    return {
      type,
      from,
      to: addWeeks(from, 1),
      label: `Vecka ${getISOWeek(from)}, ${getISOWeekYear(from)} (${format(from, 'd MMM', { locale: sv })} – ${format(endOfISOWeek(from), 'd MMM', { locale: sv })})`,
      bucket: 'day',
    };
  }
  if (type === 'month') {
    const from = startOfMonth(anchor);
    const label = format(from, 'LLLL yyyy', { locale: sv });
    return { type, from, to: addMonths(from, 1), label: label[0].toUpperCase() + label.slice(1), bucket: 'day' };
  }
  const from = startOfYear(anchor);
  return { type, from, to: addYears(from, 1), label: format(from, 'yyyy'), bucket: 'month' };
}

export function shiftPeriod(period: Period, step: 1 | -1): Date {
  if (period.type === 'week') return addWeeks(period.from, step);
  if (period.type === 'month') return addMonths(period.from, step);
  return addYears(period.from, step);
}

const emptyCounts = (): Counts => ({
  events: 0,
  pallets_placed: 0,
  pallets_picked: 0,
  skrap_reported: 0,
  skrap_removed: 0,
  kundorder_reported: 0,
  kundorder_picked: 0,
});

/** Every day (or month) of the period, with zeros where nothing happened. */
export function fillSeries(period: Period, series: ReportData['series']) {
  const byBucket = new Map(series.map((s) => [s.bucket, s]));
  const last = subDays(period.to, 1);
  const buckets =
    period.bucket === 'day'
      ? eachDayOfInterval({ start: period.from, end: last })
      : eachMonthOfInterval({ start: period.from, end: last });

  return buckets.map((date) => {
    const key = format(date, 'yyyy-MM-dd');
    return { date, ...(byBucket.get(key) ?? { bucket: key, ...emptyCounts() }) };
  });
}

export async function fetchReport(period: Period, departmentId: string | null): Promise<ReportData> {
  const { data, error } = await supabase.rpc('get_report' as never, {
    p_from: period.from.toISOString(),
    p_to: period.to.toISOString(),
    p_bucket: period.bucket,
    p_department_id: departmentId,
  } as never);
  if (error) throw error;
  return data as unknown as ReportData;
}

/** Downloads rows as a CSV that opens correctly in Swedish Excel (; separator, UTF-8 BOM). */
export function downloadCsv(fileName: string, header: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [header, ...rows].map((row) => row.map(escape).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
