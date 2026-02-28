import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (qrCode: string) => void;
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        onScan(decodedText);
        scanner.stop();
      },
      undefined
    ).catch(err => {
      console.error("Scanner error:", err);
    });

    return () => {
      scanner.stop().catch(console.error);
    };
  }, [onScan]);

  return (
    <div id="qr-reader" className="w-full rounded-lg overflow-hidden"></div>
  );
}
