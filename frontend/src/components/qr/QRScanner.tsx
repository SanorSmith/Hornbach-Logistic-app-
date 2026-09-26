import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (qrCode: string) => void;
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);

  // The parent may pass a new onScan on every render (e.g. after a realtime
  // update). Keep the latest in a ref so the camera is started only once.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader');
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      scanner.stop().catch(() => {
        // Not running (yet) or already stopped.
      });
    };

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (stopped) return;
          stop();
          onScanRef.current(decodedText);
        },
        undefined
      )
      .catch((err) => {
        console.error('Scanner error:', err);
        stopped = true;
        setError('Kameran kunde inte startas. Tillåt kameran i webbläsaren och försök igen.');
      });

    return stop;
  }, []);

  return (
    <div>
      <div id="qr-reader" className="w-full rounded-lg overflow-hidden"></div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
