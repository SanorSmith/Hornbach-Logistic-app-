import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makePoint } from '../../test/fixtures';

const mock = await vi.hoisted(async () => (await import('../../test/supabaseMock')).createSupabaseMock());
vi.mock('../../lib/supabase', () => ({ supabase: mock.supabase }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toast }));
const images = vi.hoisted(() => ({
  uploadPointImage: vi.fn(),
  deletePointImage: vi.fn(),
  pruneOldImages: vi.fn(),
  getImageUrls: vi.fn(),
}));
vi.mock('../../lib/pointImages', () => images);

import PointPalletsPanel from './PointPalletsPanel';
import PalletBadge from './PalletBadge';
import { usePalletsStore } from '../../store/palletsStore';
import type { PointAllowance, PointPallet } from '../../types';

const point = makePoint({ id: 'p1', status: 'UPPTAGEN' });

const pallet = (id: string, extra: Partial<PointPallet> = {}): PointPallet => ({
  id,
  point_id: 'p1',
  is_extra: false,
  image_id: null,
  note: null,
  placed_by: 'lf',
  placed_at: new Date().toISOString(),
  picked_at: null,
  placer: { full_name: 'Lars LineFeeder' },
  ...extra,
});

const allowance: PointAllowance = {
  id: 'a1',
  point_id: 'p1',
  max_pallets: 3,
  note: 'Kampanj v. 40',
  authorized_by_name: null,
  granted_by: 'dep',
  granted_at: new Date().toISOString(),
  ended_at: null,
  granter: { full_name: 'Anna Avdelning' },
};

const setPallets = (pallets: PointPallet[], allowances: PointAllowance[] = []) =>
  usePalletsStore.setState({ pallets, allowances });

beforeEach(() => {
  mock.reset();
  toast.success.mockReset();
  toast.error.mockReset();
  images.getImageUrls.mockReset().mockResolvedValue({});
  setPallets([]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('PointPalletsPanel', () => {
  it('shows nothing for an ordinary point with one pallet', () => {
    setPallets([pallet('x')]);
    const { container } = render(<PointPalletsPanel point={point} canPick canChange />);
    expect(container).toBeEmptyDOMElement();
  });

  it('gives the avdelning no way to lower or end the privilege once granted', () => {
    setPallets([pallet('x')], [allowance]);
    render(<PointPalletsPanel point={point} canPick />);

    expect(screen.getByText('Tillståndet hanteras av LineFeeder.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Avsluta tillstånd' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Max pallar' })).not.toBeInTheDocument();
  });

  it('shows who authorized a privilege a LineFeeder registered', () => {
    setPallets([pallet('x')], [{ ...allowance, authorized_by_name: 'Anna Avdelning', granter: { full_name: 'Lars LineFeeder' } }]);
    render(<PointPalletsPanel point={point} />);
    expect(screen.getByText(/max 3\) av Anna Avdelning \(reg\. Lars LineFeeder\)/)).toBeInTheDocument();
  });

  it('without canRaise, only offers to lower the maximum', async () => {
    setPallets([pallet('x')], [allowance]);
    render(<PointPalletsPanel point={point} canChange />);

    const max = screen.getByRole('combobox', { name: 'Max pallar' });
    expect(within(max).getAllByRole('option').map((o) => o.textContent)).toEqual(['2', '3']);
    await userEvent.selectOptions(max, '2');
    await userEvent.click(screen.getByRole('button', { name: 'Ändra' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Nu tillåts max 2 pallar'));
    expect(mock.calls).toContainEqual({ table: 'point_allowances', method: 'update', args: [{ max_pallets: 2 }] });
  });

  it('with canRaise (LineFeeder, team leader), also offers to raise the maximum', () => {
    setPallets([pallet('x')], [allowance]);
    render(<PointPalletsPanel point={point} canChange canRaise />);
    const options = within(screen.getByRole('combobox', { name: 'Max pallar' })).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['2', '3', '4', '5', '6', '7', '8', '9', '10']);
  });

  it('lists every pallet with who placed it and its comment, and each can be picked', async () => {
    setPallets([pallet('x'), pallet('y', { is_extra: true, note: 'Grillkol' })], [allowance]);
    render(<PointPalletsPanel point={point} canPick />);

    expect(screen.getByText(/Extra pallar tillåtna \(max 3\) av Anna Avdelning/)).toBeInTheDocument();
    expect(screen.getByText(/Kampanj v\. 40/)).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[1]).getByText('Grillkol')).toBeInTheDocument();
    expect(within(items[1]).getByText(/Lars LineFeeder/)).toBeInTheDocument();

    mock.respond('point_pallets', { data: [{ id: 'y' }] }); // the pick
    await userEvent.click(screen.getByRole('button', { name: 'Pall 2 plockad' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Pallen är plockad'));
    expect(mock.calls).toContainEqual({ table: 'point_pallets', method: 'eq', args: ['id', 'y'] });
  });

  it('explains when the privilege cannot be ended yet', async () => {
    setPallets([pallet('x'), pallet('y'), pallet('z')], [allowance]);
    render(<PointPalletsPanel point={point} canChange />);

    mock.respond('point_allowances', { error: { message: 'PICK_EXTRA_FIRST:3' } });
    await userEvent.click(screen.getByRole('button', { name: 'Avsluta tillstånd' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Det står 3 pallar på punkten. Plocka extrapallarna först.');
  });
});

describe('PalletBadge', () => {
  it('shows how full a point with a privilege is', () => {
    setPallets([pallet('x'), pallet('y')], [allowance]);
    render(<PalletBadge pointId="p1" />);
    expect(screen.getByText('2/3 pallar')).toBeInTheDocument();
  });

  it('shows nothing for an ordinary point', () => {
    setPallets([pallet('x')]);
    const { container } = render(<PalletBadge pointId="p1" />);
    expect(container).toBeEmptyDOMElement();
  });
});
