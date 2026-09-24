import { ScanLine } from 'lucide-react';

/** Shows that hardware (Zebra) scanning is active on this page. */
export default function ScannerReadyBadge() {
  return (
    <span
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-green-50 text-green-700 text-sm"
      title="Skanna en punkts QR-kod med Zebra-skannern för att öppna punkten"
      aria-label="Skanner redo"
    >
      <ScanLine size={16} />
      <span className="hidden sm:inline">Skanner redo</span>
    </span>
  );
}
