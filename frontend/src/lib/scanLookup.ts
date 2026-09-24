import { RedPoint } from '../types';

// Finds the red point for a scanned value (camera or hardware scanner such as
// a Zebra). Accepts "RP-003", anything containing it (e.g. a link), the stored
// qr_code, or the point's department name such as "KASSA" / "D1" if unique.

export type ScanResult = { point: RedPoint } | { error: string };

export function findPointByScan(
  points: RedPoint[],
  assignments: Record<string, string>,
  scanned: string
): ScanResult {
  const code = scanned.trim();

  const rpMatch = code.match(/RP-(\d{1,3})/i);
  if (rpMatch) {
    const pointNumber = parseInt(rpMatch[1], 10);
    const point = points.find((p) => p.point_number === pointNumber);
    if (point) return { point };
  }

  const byQr = points.find((p) => p.qr_code?.toLowerCase() === code.toLowerCase());
  if (byQr) return { point: byQr };

  const byName = points.filter((p) => assignments[p.id]?.trim().toLowerCase() === code.toLowerCase());
  if (byName.length === 1) return { point: byName[0] };
  if (byName.length > 1) return { error: `"${code}" finns i flera avdelningar – skanna punktens QR-kod` };

  return { error: `QR-kod "${code}" hittades inte i systemet` };
}
