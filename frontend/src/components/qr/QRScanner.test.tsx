import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const scanner = vi.hoisted(() => ({
  created: 0,
  start: vi.fn(),
  stop: vi.fn(),
  onDecode: null as null | ((text: string) => void),
}));
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    constructor() {
      scanner.created += 1;
    }
    start = (_camera: unknown, _config: unknown, onDecode: (text: string) => void) => {
      scanner.onDecode = onDecode;
      return scanner.start();
    };
    stop = () => scanner.stop();
  },
}));

import QRScanner from './QRScanner';

beforeEach(() => {
  scanner.created = 0;
  scanner.onDecode = null;
  scanner.start.mockReset().mockResolvedValue(undefined);
  scanner.stop.mockReset().mockResolvedValue(undefined);
});

describe('QRScanner', () => {
  it('keeps the camera running when the parent re-renders with a new callback', () => {
    const { rerender } = render(<QRScanner onScan={() => {}} />);
    rerender(<QRScanner onScan={() => {}} />);
    rerender(<QRScanner onScan={() => {}} />);
    expect(scanner.created).toBe(1);
    expect(scanner.stop).not.toHaveBeenCalled();
  });

  it('reports a scan once to the latest callback and stops the camera', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(<QRScanner onScan={first} />);
    rerender(<QRScanner onScan={latest} />);
    scanner.onDecode!('RP-003');
    scanner.onDecode!('RP-003');
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(scanner.stop).toHaveBeenCalledTimes(1);
  });

  it('stops the camera when closed', () => {
    const { unmount } = render(<QRScanner onScan={() => {}} />);
    unmount();
    expect(scanner.stop).toHaveBeenCalledTimes(1);
  });

  it('explains when the camera cannot start', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    scanner.start.mockRejectedValue(new Error('NotAllowedError'));
    render(<QRScanner onScan={() => {}} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Kameran kunde inte startas');
  });
});
