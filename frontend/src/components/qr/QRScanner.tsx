import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (qrCode: string) => void;
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppedRef = useRef(false);

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    isStoppedRef.current = false;

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        if (!isStoppedRef.current) {
          isStoppedRef.current = true;
          scanner.stop().catch(() => {
            // Ignore stop errors
          });
          onScan(decodedText);
        }
      },
      undefined
    ).catch(err => {
      console.error("Scanner error:", err);
    });

    return () => {
      if (scannerRef.current && !isStoppedRef.current) {
        isStoppedRef.current = true;
        scannerRef.current.stop().catch(() => {
          // Ignore stop errors during cleanup
        });
      }
    };
  }, [onScan]);

  return (
    <div id="qr-reader" className="w-full rounded-lg overflow-hidden"></div>
  );
}
