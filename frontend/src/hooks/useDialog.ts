import { useEffect, useRef } from 'react';

// Open dialogs. Escape only closes the top-most one (e.g. the photo viewer on
// top of a point dialog): the one no other open dialog is inside of or after.
const openDialogs = new Set<HTMLElement>();

function isTopMost(element: HTMLElement) {
  for (const other of openDialogs) {
    if (other === element) continue;
    if (element.contains(other)) return false;
    if (element.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) return false;
  }
  return true;
}

/**
 * Keyboard and screen-reader behaviour for a modal dialog. Put the returned
 * ref on the dialog's outer element together with
 * `role="dialog" aria-modal="true" aria-label="…" tabIndex={-1}`.
 * While open, Escape calls onClose and focus is moved into the dialog; it goes
 * back to where it was when the dialog closes.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const element = ref.current;
    if (!open || !element) return;
    openDialogs.add(element);
    const previousFocus = document.activeElement as HTMLElement | null;
    if (!element.contains(document.activeElement)) element.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isTopMost(element)) {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openDialogs.delete(element);
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
    };
  }, [open]);

  return ref;
}
