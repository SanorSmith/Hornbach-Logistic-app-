import { useEffect, useRef } from 'react';

// Hardware scanners (e.g. Zebra TC2x with DataWedge keystroke output, or USB /
// Bluetooth scanners in keyboard mode) "type" the scanned value very quickly,
// usually followed by Enter. People type much slower, so fast bursts are
// treated as scans and slow typing is ignored.

const MAX_KEY_GAP_MS = 60; // longer pause between keys = a person typing
const IDLE_SUBMIT_MS = 150; // submit a code-looking burst even without Enter
const MIN_LENGTH = 2;

function isEditable(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * Calls `onScan` with the scanned text whenever a hardware scanner reads a code
 * while this page is open. Scans are ignored while the user is typing in a
 * text field, so they never overwrite notes or forms.
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    let buffer = '';
    let lastKeyAt = 0;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const submit = () => {
      clearTimeout(idleTimer);
      const code = buffer.trim();
      buffer = '';
      if (code.length >= MIN_LENGTH) onScanRef.current(code);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditable(event.target) || event.ctrlKey || event.altKey || event.metaKey) return;

      const now = performance.now();
      if (now - lastKeyAt > MAX_KEY_GAP_MS) buffer = '';
      lastKeyAt = now;

      if (event.key === 'Enter' || event.key === 'Tab') {
        if (buffer.length >= MIN_LENGTH) {
          event.preventDefault();
          submit();
        }
        return;
      }

      if (event.key.length !== 1) return; // Shift, arrows, etc.
      buffer += event.key;

      // Some scanner setups send no Enter; submit once the burst stops.
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (buffer.length >= 4) submit();
        else buffer = '';
      }, IDLE_SUBMIT_MS);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      clearTimeout(idleTimer);
    };
  }, [enabled]);
}
