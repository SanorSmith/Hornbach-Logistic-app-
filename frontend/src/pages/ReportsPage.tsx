import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ArrowLeft, BarChart3, ChevronLeft, ChevronRight, Download, FileText, Loader2, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { ROLE_LABELS } from '../lib/access';
import { useAuth } from '../hooks/useAuth';
import { downloadReportPdf, printReportPdf, ReportPdfOptions } from '../lib/reportPdf';
import { UserRole } from '../types';
import {
  Counts,
  downloadCsv,
  fetchReport,
  fillSeries,
  getPeriod,
  METRICS,
  MetricKey,
  Period,
  PeriodType,
  ReportData,
  shiftPeriod,
} from '../lib/reports';

type Tab = 'departments' | 'users' | 'points';

interface Row extends Counts {
  key: string;
  name: string;
  detail?: string;
  role?: string | null;
}

function sumRows(rows: Row[]): Counts {
  const total = { events: 0 } as Counts;
  for (const m of METRICS) total[m.key] = 0;
  for (const r of rows) {
    total.events += r.events;
    for (const m of METRICS) total[m.key] += r[m.key];
  }
  return total;
}

const PERIOD_TYPES: { key: PeriodType; label: string }[] = [
  { key: 'week', label: 'Vecka' },
  { key: 'month', label: 'Månad' },
  { key: 'year', label: 'År' },
];

const TABS: { key: Tab; label: string }[] = [
  { key: 'departments', label: 'Avdelningar' },
  { key: 'users', label: 'Användare' },
  { key: 'points', label: 'Röda punkter' },
];

export default function ReportsPage() {
  const navigate = useNavigate();
  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [departmentId, setDepartmentId] = useState<string>('');
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<MetricKey>('pallets_placed');
  const [tab, setTab] = useState<Tab>('departments');
  const [onlyLineFeeders, setOnlyLineFeeders] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<'pdf' | 'print' | null>(null);
  const { user } = useAuth();

  const period = useMemo(() => getPeriod(periodType, anchor), [periodType, anchor]);
  const requestKey = `${period.type}|${period.from.toISOString()}|${departmentId}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    supabase
      .from('departments')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setDepartments((data as { id: string; name: string }[]) ?? []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchReport(period, departmentId || null)
      .then((data) => !cancelled && setReport(data))
      .catch((error) => {
        console.error('Error loading report:', error);
        if (!cancelled) toast.error('Kunde inte hämta rapporten');
      })
      .finally(() => !cancelled && setLoadedKey(requestKey));
    return () => {
      cancelled = true;
    };
  }, [period, departmentId, requestKey]);

  const rows: Row[] = useMemo(() => {
    if (!report) return [];
    if (tab === 'departments') {
      return report.by_department.map((d) => ({ ...d, key: d.id ?? 'none', name: d.name.trim() }));
    }
    if (tab === 'users') {
      return report.by_user
        .filter((u) => !onlyLineFeeders || u.role === 'LINEFEEDER')
        .map((u) => ({
          ...u,
          key: u.id,
          detail: u.role ? ROLE_LABELS[u.role as UserRole] ?? u.role : undefined,
        }));
    }
    return report.by_point.map((p) => ({
      ...p,
      key: p.id,
      name: p.name?.trim() || `Punkt ${p.point_number}`,
      detail: `#${p.point_number} · ${p.department.trim()}`,
    }));
  }, [report, tab, onlyLineFeeders]);

  const departmentName = departments.find((d) => d.id === departmentId)?.name.trim();

  const pdfOptions = (): ReportPdfOptions | null =>
    report
      ? {
          report,
          period,
          departmentName: departmentName ?? null,
          chartMetric,
          generatedBy: user?.full_name ?? null,
          roleLabel: (role) => (role ? ROLE_LABELS[role as UserRole] ?? role : ''),
        }
      : null;

  const handlePdf = async () => {
    const opts = pdfOptions();
    if (!opts) return;
    setPdfBusy('pdf');
    try {
      await downloadReportPdf(opts);
    } catch (error) {
      console.error('Error creating report PDF:', error);
      toast.error('Kunde inte skapa PDF');
    } finally {
      setPdfBusy(null);
    }
  };

  const handlePrint = async () => {
    const opts = pdfOptions();
    if (!opts) return;
    // Open the tab synchronously so the browser doesn't block it as a popup.
    const tab = window.open('', '_blank');
    setPdfBusy('print');
    try {
      await printReportPdf(opts, tab);
    } catch (error) {
      console.error('Error printing report:', error);
      tab?.close();
      toast.error('Kunde inte skriva ut rapporten');
    } finally {
      setPdfBusy(null);
    }
  };

  const exportCsv = () => {
    if (!report) return;
    const tabLabel = TABS.find((t) => t.key === tab)!.label;
    const header = [
      tab === 'points' ? 'Punkt' : 'Namn',
      ...(tab === 'departments' ? [] : [tab === 'users' ? 'Roll' : 'Punkt-ID / Avdelning']),
      ...METRICS.map((m) => m.label),
      'Totalt antal händelser',
    ];
    const body = rows.map((r) => [
      r.name,
      ...(tab === 'departments' ? [] : [r.detail ?? '']),
      ...METRICS.map((m) => r[m.key]),
      r.events,
    ]);
    const sum = sumRows(rows);
    const totals = ['Totalt', ...(tab === 'departments' ? [] : ['']), ...METRICS.map((m) => sum[m.key]), sum.events];
    const slug = `${period.type}-${format(period.from, 'yyyy-MM-dd')}${departmentName ? '-' + departmentName.toLowerCase() : ''}`;
    downloadCsv(`rapport-${tabLabel.toLowerCase().replace(/\s+/g, '-')}-${slug}.csv`, header, [...body, totals]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BarChart3 size={30} className="text-green-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Rapporter</h1>
              <p className="text-sm text-gray-600">Pallar, skräp och kundorder per period</p>
            </div>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            <ArrowLeft size={20} />
            <span className="hidden sm:inline">Tillbaka</span>
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Filters: one row above everything they control */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="inline-flex rounded-lg bg-gray-100 p-1 self-start">
            {PERIOD_TYPES.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriodType(p.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                  periodType === p.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAnchor(shiftPeriod(period, -1))}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
              aria-label="Föregående period"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-[12rem] text-center font-semibold text-gray-800">{period.label}</span>
            <button
              onClick={() => setAnchor(shiftPeriod(period, 1))}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
              aria-label="Nästa period"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => setAnchor(new Date())}
              className="ml-1 px-3 py-2 rounded-lg text-sm text-indigo-700 hover:bg-indigo-50"
            >
              Idag
            </button>
          </div>

          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="lg:ml-auto px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Alla avdelningar</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name.trim()}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-3 gap-2 lg:flex">
            <button
              onClick={handlePrint}
              disabled={!report || loading || pdfBusy !== null}
              className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              {pdfBusy === 'print' ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
              Skriv ut
            </button>
            <button
              onClick={handlePdf}
              disabled={!report || loading || pdfBusy !== null}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {pdfBusy === 'pdf' ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
              PDF
            </button>
            <button
              onClick={exportCsv}
              disabled={!report || loading}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              <Download size={18} />
              Excel
            </button>
          </div>
        </div>

        {loading && !report ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-gray-400" size={36} />
          </div>
        ) : report ? (
          <div className={`space-y-6 transition-opacity ${loading ? 'opacity-50' : ''}`}>
            {/* KPI tiles */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setChartMetric(m.key)}
                  className={`text-left bg-white rounded-xl border p-4 shadow-sm transition hover:shadow ${
                    chartMetric === m.key ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200'
                  }`}
                >
                  <p className="text-sm text-gray-600">{m.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{report.totals[m.key]}</p>
                </button>
              ))}
            </div>

            {/* Trend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h2 className="font-semibold text-gray-800">
                  {METRICS.find((m) => m.key === chartMetric)!.label} per {period.bucket === 'day' ? 'dag' : 'månad'}
                </h2>
                <select
                  value={chartMetric}
                  onChange={(e) => setChartMetric(e.target.value as MetricKey)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                >
                  {METRICS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <TrendChart period={period} series={report.series} metric={chartMetric} />
            </div>

            {/* Breakdown tables */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 pt-4 pb-3 border-b border-gray-200">
                <div className="flex gap-1">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        tab === t.key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {tab === 'users' && (
                  <label className="sm:ml-auto flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={onlyLineFeeders}
                      onChange={(e) => setOnlyLineFeeders(e.target.checked)}
                      className="rounded"
                    />
                    Endast LineFeeders
                  </label>
                )}
              </div>
              <BreakdownTable rows={rows} showDetail={tab !== 'departments'} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TrendChart({ period, series, metric }: { period: Period; series: ReportData['series']; metric: MetricKey }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = useMemo(() => fillSeries(period, series), [period, series]);
  const values = data.map((d) => d[metric]);
  const max = Math.max(1, ...values);
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max];
  const labelEvery = data.length > 14 ? 5 : 1;
  const labelFor = (date: Date) =>
    period.bucket === 'month'
      ? format(date, 'LLL', { locale: sv })
      : period.type === 'week'
        ? format(date, 'EEE d', { locale: sv })
        : format(date, 'd');
  const tooltipFor = (date: Date) =>
    period.bucket === 'month' ? format(date, 'LLLL yyyy', { locale: sv }) : format(date, 'EEEE d MMMM', { locale: sv });

  if (values.every((v) => v === 0)) {
    return <p className="text-center text-gray-500 py-16">Inga händelser under perioden.</p>;
  }

  return (
    <div className="flex gap-3 pt-3">
      {/* y-axis */}
      <div className="relative h-56 w-6 shrink-0 text-xs text-gray-500 tabular-nums">
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / max) * 100}%` }}>
            {t}
          </span>
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <div className="relative h-56">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-gray-100" style={{ bottom: `${(t / max) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d, i) => (
              <div
                key={d.bucket}
                className="relative flex-1 h-full flex items-end"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className={`w-full max-w-12 mx-auto rounded-t ${hover === i ? 'bg-indigo-700' : 'bg-indigo-500'}`}
                  style={{ height: `${(d[metric] / max) * 100}%`, minHeight: d[metric] > 0 ? 3 : 0 }}
                />
                {hover === i && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg z-10 pointer-events-none">
                    <div className="text-gray-300">{tooltipFor(d.date)}</div>
                    <div className="font-semibold tabular-nums">{d[metric]}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-[2px] mt-2 text-[11px] text-gray-500">
          {data.map((d, i) => (
            <div key={d.bucket} className="relative flex-1 h-4">
              {i % labelEvery === 0 && (
                <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{labelFor(d.date)}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BreakdownTable({ rows, showDetail }: { rows: Row[]; showDetail: boolean }) {
  if (rows.length === 0) {
    return <p className="text-center text-gray-500 py-12">Inga händelser under perioden.</p>;
  }
  const totals = sumRows(rows);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-600 border-b border-gray-200">
            <th className="px-5 py-3 font-medium">Namn</th>
            {METRICS.map((m) => (
              <th key={m.key} className="px-3 py-3 font-medium text-right whitespace-nowrap">
                {m.label}
              </th>
            ))}
            <th className="px-5 py-3 font-medium text-right">Totalt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-5 py-3">
                <div className="font-medium text-gray-900">{r.name}</div>
                {showDetail && r.detail && <div className="text-xs text-gray-500">{r.detail}</div>}
              </td>
              {METRICS.map((m) => (
                <td key={m.key} className={`px-3 py-3 text-right tabular-nums ${r[m.key] ? 'text-gray-900' : 'text-gray-300'}`}>
                  {r[m.key]}
                </td>
              ))}
              <td className="px-5 py-3 text-right tabular-nums font-semibold text-gray-900">{r.events}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-semibold text-gray-900">
            <td className="px-5 py-3">Totalt</td>
            {METRICS.map((m) => (
              <td key={m.key} className="px-3 py-3 text-right tabular-nums">
                {totals[m.key]}
              </td>
            ))}
            <td className="px-5 py-3 text-right tabular-nums">{totals.events}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
