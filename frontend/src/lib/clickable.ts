import type { KeyboardEvent } from 'react';

/**
 * Props that make a clickable card usable from the keyboard and by screen
 * readers: focusable, announced as a button, opened with Enter or Space.
 */
export function clickableProps(onActivate: () => void, label: string) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': label,
    onClick: onActivate,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.target !== event.currentTarget) return; // e.g. a button inside the card
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onActivate();
      }
    },
  };
}
