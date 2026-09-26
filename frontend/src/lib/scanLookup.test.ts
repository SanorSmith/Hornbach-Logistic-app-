import { describe, expect, it } from 'vitest';
import { findPointByScan } from './scanLookup';
import { makePoint } from '../test/fixtures';

const p3 = makePoint({ id: 'a', point_number: 3, qr_code: 'RP-003' });
const p12 = makePoint({ id: 'b', point_number: 12, qr_code: 'RP-012' });
const p40 = makePoint({ id: 'c', point_number: 40, qr_code: 'CUSTOM-40' });
const points = [p3, p12, p40];
const names = { a: 'KASSA', b: 'D1', c: 'T3' };

describe('findPointByScan', () => {
  it('finds a point by its RP code', () => {
    expect(findPointByScan(points, names, 'RP-003')).toEqual({ point: p3 });
    expect(findPointByScan(points, names, 'rp-12')).toEqual({ point: p12 });
  });

  it('finds the RP code inside a link or with whitespace from the scanner', () => {
    expect(findPointByScan(points, names, '  https://example.com/scan?code=RP-012\n')).toEqual({ point: p12 });
  });

  it('accepts store-prefixed codes such as 773-RP-003', () => {
    expect(findPointByScan(points, names, '773-RP-003')).toEqual({ point: p3 });
  });

  it('finds a point by its stored qr_code', () => {
    expect(findPointByScan(points, names, 'custom-40')).toEqual({ point: p40 });
  });

  it('finds a point by its avdelning name, ignoring case', () => {
    expect(findPointByScan(points, names, 'kassa')).toEqual({ point: p3 });
    expect(findPointByScan(points, names, 'D1')).toEqual({ point: p12 });
  });

  it('asks for the QR code when a name exists in several avdelningar', () => {
    const result = findPointByScan(points, { a: 'T3', b: 'T3' }, 'T3');
    expect(result).toEqual({ error: expect.stringContaining('flera avdelningar') });
  });

  it('reports unknown codes', () => {
    expect(findPointByScan(points, names, 'RP-999')).toEqual({ error: expect.stringContaining('hittades inte') });
    expect(findPointByScan(points, names, 'nonsense')).toEqual({ error: expect.stringContaining('hittades inte') });
  });
});
