import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = await vi.hoisted(async () => (await import('../test/supabaseMock')).createSupabaseMock());
vi.mock('./supabase', () => ({ supabase: mock.supabase }));
const images = vi.hoisted(() => ({
  uploadPointImage: vi.fn(),
  deletePointImage: vi.fn(),
}));
vi.mock('./pointImages', () => images);

import { allowanceAuthorizer, grantAllowance, palletErrorMessage, palletSummary, placePallet } from './pallets';
import type { PointAllowance, PointPallet } from '../types';

const pallet = (id: string, point_id: string, picked_at: string | null = null): PointPallet => ({
  id,
  point_id,
  is_extra: false,
  image_id: null,
  note: null,
  placed_by: 'u1',
  placed_at: '2026-09-26T08:00:00Z',
  picked_at,
});

const allowance = (point_id: string, max_pallets: number): PointAllowance => ({
  id: `a-${point_id}`,
  point_id,
  max_pallets,
  note: null,
  authorized_by_name: null,
  granted_by: 'u2',
  granted_at: '2026-09-26T07:00:00Z',
  ended_at: null,
});

beforeEach(() => {
  mock.reset();
  images.uploadPointImage.mockReset().mockResolvedValue('img-1');
  images.deletePointImage.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('palletSummary', () => {
  it('counts the open pallets on a point and its limit', () => {
    const pallets = [pallet('x', 'p1'), pallet('y', 'p1'), pallet('z', 'p1', '2026-09-26T09:00:00Z'), pallet('w', 'p2')];
    expect(palletSummary(pallets, [allowance('p1', 3)], 'p1')).toMatchObject({ max: 3 });
    expect(palletSummary(pallets, [allowance('p1', 3)], 'p1').open.map((p) => p.id)).toEqual(['x', 'y']);
  });

  it('allows one pallet without a privilege', () => {
    expect(palletSummary([pallet('w', 'p2')], [allowance('p1', 3)], 'p2')).toMatchObject({ allowance: null, max: 1 });
  });
});

describe('palletErrorMessage', () => {
  it.each([
    ['PALLET_LIMIT:1', 'Punkten har redan en pall. Avdelningen kan tillåta extra pallar.'],
    ['PALLET_LIMIT:3', 'Punkten är full (max 3 pallar).'],
    ['ALLOWANCE_TOO_LOW:4', 'Det står 4 pallar på punkten. Välj minst 4.'],
    ['PICK_EXTRA_FIRST:3', 'Det står 3 pallar på punkten. Plocka extrapallarna först.'],
    ['AUTHORIZED_BY_REQUIRED', 'Skriv namnet på den som godkände extra pallar.'],
    ['duplicate key value violates unique constraint "point_allowances_one_active_idx"', 'Punkten har redan ett tillstånd för extra pallar.'],
    ['new row violates row-level security policy for table "point_allowances"', 'Du har inte behörighet att göra det här.'],
    ['Failed to fetch', 'Det gick inte att spara. Kontrollera anslutningen och försök igen.'],
  ])('%s', (message, expected) => {
    expect(palletErrorMessage({ message })).toBe(expected);
  });

  it('shows the rate limit countdown', () => {
    expect(palletErrorMessage({ message: 'RATE_LIMIT:42' })).toContain('Försök igen om 42 s.');
  });
});

describe('placePallet', () => {
  const photo = new File(['x'], 'pall.jpg', { type: 'image/jpeg' });

  it('saves the photo and the pallet with its comment', async () => {
    await placePallet('p1', photo, '  Kampanjpall  ');
    expect(images.uploadPointImage).toHaveBeenCalledWith('p1', photo, '  Kampanjpall  ');
    expect(mock.calls).toContainEqual({
      table: 'point_pallets',
      method: 'insert',
      args: [{ point_id: 'p1', image_id: 'img-1', note: 'Kampanjpall' }],
    });
    expect(images.deletePointImage).not.toHaveBeenCalled();
  });

  it('removes the photo again when the database refuses the pallet', async () => {
    mock.respond('point_pallets', { error: { message: 'PALLET_LIMIT:3' } });
    await expect(placePallet('p1', photo, '')).rejects.toMatchObject({ message: 'PALLET_LIMIT:3' });
    expect(images.deletePointImage).toHaveBeenCalledWith('img-1');
  });
});

describe('grantAllowance', () => {
  it('sends only the point, the number and the reason', async () => {
    await grantAllowance('p1', 3, ' Kampanj ');
    expect(mock.calls).toContainEqual({
      table: 'point_allowances',
      method: 'insert',
      args: [{ point_id: 'p1', max_pallets: 3, note: 'Kampanj', authorized_by_name: null }],
    });
  });

  it('sends who authorized it when a LineFeeder registers it', async () => {
    await grantAllowance('p1', 2, '', '  Anna Avdelning ');
    expect(mock.calls).toContainEqual({
      table: 'point_allowances',
      method: 'insert',
      args: [{ point_id: 'p1', max_pallets: 2, note: null, authorized_by_name: 'Anna Avdelning' }],
    });
  });
});

describe('allowanceAuthorizer', () => {
  it('names who approved it and who registered it', () => {
    const a = { ...allowance('p1', 3), granter: { full_name: 'Lars LineFeeder' } };
    expect(allowanceAuthorizer(a)).toBe('Lars LineFeeder');
    expect(allowanceAuthorizer({ ...a, authorized_by_name: 'Anna Avdelning' })).toBe('Anna Avdelning (reg. Lars LineFeeder)');
  });
});
