// Builds a single A4 PDF page with one QR code per point, laid out in the
// grid that gives the largest codes that still fit on the page.
// jspdf and qrcode are loaded on demand so they don't grow the main bundle.

export interface QrSheetItem {
  /** Value encoded in the QR code, e.g. "RP-003" (what the scanner expects). */
  code: string;
  /** Large label under the code, e.g. "KASSA" or "Punkt 3". */
  title: string;
  /** Optional small text shown before the code, e.g. the department name. */
  subtitle?: string;
}

const PAGE_W = 210; // A4 portrait, mm
const PAGE_H = 297;
const MARGIN = 10;
const HEADER_H = 14;
const GAP = 4;

/** Picks columns/rows for `count` cells so the QR codes are as large as possible. */
function bestGrid(count: number, width: number, height: number) {
  let best = { cols: 1, rows: count, qr: 0 };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const cellW = (width - GAP * (cols - 1)) / cols;
    const cellH = (height - GAP * (rows - 1)) / rows;
    const labelH = Math.min(cellH * 0.22, 14);
    const qr = Math.min(cellW - 4, cellH - labelH - 4);
    if (qr > best.qr) best = { cols, rows, qr };
  }
  return best;
}

export async function downloadQrSheet(items: QrSheetItem[], heading: string, fileName: string) {
  if (items.length === 0) return;

  const [{ jsPDF }, QRCode] = await Promise.all([import('jspdf'), import('qrcode')]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(heading, MARGIN, MARGIN + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    `${items.length} punkter · ${new Date().toLocaleDateString('sv-SE')}`,
    PAGE_W - MARGIN,
    MARGIN + 6,
    { align: 'right' }
  );
  doc.setTextColor(0);

  const areaX = MARGIN;
  const areaY = MARGIN + HEADER_H;
  const areaW = PAGE_W - MARGIN * 2;
  const areaH = PAGE_H - MARGIN * 2 - HEADER_H;
  const { cols, rows, qr } = bestGrid(items.length, areaW, areaH);
  const cellW = (areaW - GAP * (cols - 1)) / cols;
  const cellH = (areaH - GAP * (rows - 1)) / rows;
  const titleSize = Math.max(8, Math.min(22, qr * 0.28));

  const images = await Promise.all(
    items.map((item) =>
      QRCode.toDataURL(item.code, { errorCorrectionLevel: 'H', margin: 1, width: 600 })
    )
  );

  items.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = areaX + col * (cellW + GAP);
    const y = areaY + row * (cellH + GAP);

    // Dashed cut line around each code.
    doc.setDrawColor(190);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.roundedRect(x, y, cellW, cellH, 2, 2);
    doc.setLineDashPattern([], 0);

    const labelH = Math.min(cellH * 0.22, 14);
    const qrX = x + (cellW - qr) / 2;
    const qrY = y + (cellH - labelH - qr) / 2;
    doc.addImage(images[i], 'PNG', qrX, qrY, qr, qr);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(titleSize);
    const titleY = qrY + qr + titleSize * 0.4 + 1;
    doc.text(item.title, x + cellW / 2, titleY, { align: 'center', maxWidth: cellW - 4 });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(Math.max(6, titleSize * 0.45));
    doc.setTextColor(120);
    doc.text(item.subtitle ? `${item.subtitle} · ${item.code}` : item.code, x + cellW / 2, titleY + titleSize * 0.35 + 1.5, {
      align: 'center',
      maxWidth: cellW - 2,
    });
    doc.setTextColor(0);
  });

  doc.save(fileName);
}
