import { useState } from 'react';

const PREFIX = 'rodapunkter.';

function read(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(PREFIX + key) ?? fallback;
  } catch {
    return fallback; // storage blocked (private mode, policy): just don't remember
  }
}

function write(key: string, value: string) {
  try {
    if (value) window.localStorage.setItem(PREFIX + key, value);
    else window.localStorage.removeItem(PREFIX + key);
  } catch {
    // storage blocked or full: the setting simply isn't remembered
  }
}

/**
 * A text setting remembered on this device only (e.g. a handheld's avdelning
 * filter). Never shared between devices and never needed for correctness.
 */
export function useDeviceSetting(key: string, fallback = ''): [string, (value: string) => void] {
  const [value, setValue] = useState(() => read(key, fallback));
  const update = (next: string) => {
    setValue(next);
    write(key, next);
  };
  return [value, update];
}
