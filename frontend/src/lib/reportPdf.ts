import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Counts, fillSeries, METRICS, MetricKey, Period, pointRows, ReportData } from './reports';

// A4 PDF version of the Rapporter page: totals, trend chart and the three
// breakdown tables. jspdf / jspdf-autotable are loaded on demand.

export interface ReportPdfOptions {
  report: ReportData;
  period: Period;
  departmentName: string | null;
  chartMetric: MetricKey;
  generatedBy: string | null;
  roleLabel: (role: string | null) => string;
}

const INDIGO: [number, number, number] = [99, 102, 241];
const GRAY_TEXT = 110;
const MARGIN = 14;

type Row = Counts & { name: string; detail?: string };

async function buildReportPdf(opts: ReportPdfOptions) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const { report, period, departmentName, chartMetric } = opts;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - MARGIN * 2;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Rapport – Godsmotagning Logistik', MARGIN, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${period.label} · ${departmentName ?? 'Alla avdelningar'}`, MARGIN, 27);
  doc.setFontSize(8);
  doc.setTextColor(GRAY_TEXT);
  doc.text(
    `Skapad ${format(new Date(), "d MMMM yyyy 'kl.' HH:mm", { locale: sv })}${opts.generatedBy ? ` av ${opts.generatedBy}` : ''}`,
    MARGIN,
    32
  );
  doc.setTextColor(0);

  // Totals: 6 tiles in one row
  let y = 38;
  const gap = 3;
  const tileW = (contentW - gap * 5) / 6;
  METRICS.forEach((m, i) => {
    const x = MARGIN + i * (tileW + gap);
    doc.setDrawColor(220);
    doc.roundedRect(x, y, tileW, 20, 2, 2);
    doc.setFontSize(7);
    doc.setTextColor(GRAY_TEXT);
    doc.text(m.label, x + 3, y + 6, { maxWidth: tileW - 6 });
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(String(report.totals[m.key]), x + 3, y + 16);
    doc.setFont('helvetica', 'normal');
  });
  y += 28;

  // Trend chart for the selected metric
  const metricLabel = METRICS.find((m) => m.key === chartMetric)!.label;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${metricLabel} per ${period.bucket === 'day' ? 'dag' : 'månad'}`, MARGIN, y);
  doc.setFont('helvetica', 'normal');
  y += 4;

  const data = fillSeries(period, report.series);
  const values = data.map((d) => d[chartMetric]);
  const max = Math.max(1, ...values);
  const chartH = 42;
  const axisW = 8;
  const plotX = MARGIN + axisW;
  const plotW = contentW - axisW;
  const slot = plotW / data.length;
  const barW = Math.min(12, slot * 0.7);

  doc.setFontSize(7);
  doc.setTextColor(GRAY_TEXT);
  [0, Math.round(max / 2), max].forEach((t) => {
    const ty = y + chartH - (t / max) * chartH;
    doc.setDrawColor(235);
    doc.line(plotX, ty, plotX + plotW, ty);
    doc.text(String(t), plotX - 2, ty + 1, { align: 'right' });
  });

  const labelEvery = data.length > 14 ? 5 : 1;
  data.forEach((d, i) => {
    const v = d[chartMetric];
    const h = (v / max) * chartH;
    const bx = plotX + i * slot + (slot - barW) / 2;
    if (v > 0) {
      // Text drawing changes the fill colour in jsPDF, so set it for every bar.
      doc.setFillColor(...INDIGO);
      doc.rect(bx, y + chartH - h, barW, h, 'F');
    }
    if (i % labelEvery === 0) {
      const label =
        period.bucket === 'month'
          ? format(d.date, 'LLL', { locale: sv })
          : period.type === 'week'
            ? format(d.date, 'EEE d', { locale: sv })
            : format(d.date, 'd');
      doc.text(label, bx + barW / 2, y + chartH + 4, { align: 'center' });
    }
  });
  doc.setTextColor(0);
  y += chartH + 12;

  // Breakdown tables
  const sections: { title: string; rows: Row[]; showDetail: boolean }[] = [
    {
      title: 'Per avdelning',
      rows: report.by_department.map((d) => ({ ...d, name: d.name.trim() })),
      showDetail: false,
    },
    {
      title: 'Per användare',
      rows: report.by_user.map((u) => ({ ...u, detail: opts.roleLabel(u.role) })),
      showDetail: true,
    },
    {
      title: 'Per röd punkt',
      rows: pointRows(report),
      showDetail: true,
    },
  ];

  for (const section of sections) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(section.title, MARGIN, y);
    doc.setFont('helvetica', 'normal');

    const sum = { events: 0 } as Counts;
    for (const m of METRICS) sum[m.key] = section.rows.reduce((a, r) => a + r[m.key], 0);
    sum.events = section.rows.reduce((a, r) => a + r.events, 0);

    autoTable(doc, {
      startY: y + 2,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Namn', ...METRICS.map((m) => m.short), 'Totalt']],
      body:
        section.rows.length > 0
          ? section.rows.map((r) => [
              section.showDetail && r.detail ? `${r.name}\n${r.detail}` : r.name,
              ...METRICS.map((m) => r[m.key]),
              r.events,
            ])
          : [[{ content: 'Inga händelser under perioden', colSpan: METRICS.length + 2, styles: { textColor: GRAY_TEXT } }]],
      foot: section.rows.length > 0 ? [['Totalt', ...METRICS.map((m) => sum[m.key]), sum.events]] : undefined,
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [243, 244, 246], textColor: 60, fontStyle: 'bold' },
      footStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: 'bold' },
      columnStyles: Object.fromEntries(
        Array.from({ length: METRICS.length + 1 }, (_, i) => [i + 1, { halign: 'right' as const }])
      ),
      theme: 'grid',
      didParseCell: (hook) => {
        // Right-align number columns in the header and total row too.
        if (hook.column.index > 0 && hook.section !== 'body') hook.cell.styles.halign = 'right';
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(GRAY_TEXT);
    doc.text(`Sida ${i} av ${pages}`, pageW - MARGIN, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
  }

  return doc;
}

export function reportFileName(period: Period, departmentName: string | null) {
  const dept = departmentName ? `-${departmentName.trim().toLowerCase().replace(/\s+/g, '-')}` : '';
  return `rapport-${period.type}-${format(period.from, 'yyyy-MM-dd')}${dept}.pdf`;
}

export async function downloadReportPdf(opts: ReportPdfOptions) {
  const doc = await buildReportPdf(opts);
  doc.save(reportFileName(opts.period, opts.departmentName));
}

/** Opens the report PDF in a new tab with the print dialog. */
export async function printReportPdf(opts: ReportPdfOptions, target: Window | null) {
  const doc = await buildReportPdf(opts);
  doc.autoPrint();
  const url = doc.output('bloburl') as unknown as string;
  if (target) {
    target.location.href = url;
  } else {
    window.open(url, '_blank');
  }
}
