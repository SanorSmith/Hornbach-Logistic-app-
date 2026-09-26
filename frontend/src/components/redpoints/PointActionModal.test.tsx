import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const getLimitedChangeWait = vi.fn();
vi.mock('../../lib/rateLimit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/rateLimit')>()),
  getLimitedChangeWait: () => getLimitedChangeWait(),
}));
vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../lib/pointImages', () => ({
  uploadPointImage: vi.fn(),
  deletePointImage: vi.fn(),
  pruneOldImages: vi.fn(),
  getImageUrls: vi.fn().mockResolvedValue({}),
}));
const placePallet = vi.hoisted(() => vi.fn());
vi.mock('../../lib/pallets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/pallets')>()),
  placePallet,
}));
vi.mock('../../hooks/usePallets', () => ({ loadPallets: vi.fn() }));
vi.mock('../../hooks/usePointDetails', () => ({
  usePointDetails: () => ({ name: 'T3', departmentName: 'Trädgård', departmentLocation: 'Botkyrka' }),
}));
vi.mock('./PointImageGallery', () => ({ default: () => <div>gallery</div> }));

import PointActionModal from './PointActionModal';
import { makePoint } from '../../test/fixtures';
import { usePalletsStore } from '../../store/palletsStore';
import type { PointAllowance, PointPallet } from '../../types';

const ALL = ['LEDIG', 'UPPTAGEN', 'SKRAP', 'KUNDORDER'] as const;

const pallet = (id: string): PointPallet => ({
  id,
  point_id: 'p1',
  is_extra: id !== 'x',
  image_id: null,
  note: null,
  placed_by: 'lf',
  placed_at: new Date().toISOString(),
  picked_at: null,
});

const allowance: PointAllowance = {
  id: 'a1',
  point_id: 'p1',
  max_pallets: 3,
  note: null,
  granted_by: 'dep',
  granted_at: new Date().toISOString(),
  ended_at: null,
};

beforeEach(() => {
  getLimitedChangeWait.mockReset().mockResolvedValue(0);
  placePallet.mockReset().mockResolvedValue(undefined);
  usePalletsStore.setState({ pallets: [], allowances: [] });
});

describe('PointActionModal', () => {
  it('shows the point name and its avdelning', () => {
    render(<PointActionModal point={makePoint()} onClose={() => {}} onUpdateStatus={vi.fn()} allowedActions={[...ALL]} />);
    expect(screen.getByText('Trädgård')).toBeInTheDocument();
  });

  it('saves a status change and closes', async () => {
    const onUpdateStatus = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(<PointActionModal point={makePoint({ status: 'SKRAP' })} onClose={onClose} onUpdateStatus={onUpdateStatus} allowedActions={[...ALL]} />);
    await userEvent.click(screen.getByRole('button', { name: /Markera som Ledig/ }));
    expect(onUpdateStatus).toHaveBeenCalledWith('LEDIG', undefined);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('asks for a photo before marking Upptagen instead of saving directly', async () => {
    const onUpdateStatus = vi.fn();
    render(<PointActionModal point={makePoint()} onClose={() => {}} onUpdateStatus={onUpdateStatus} allowedActions={[...ALL]} />);
    const camera = document.querySelector('input[type="file"]') as HTMLInputElement;
    const openCamera = vi.spyOn(camera, 'click').mockImplementation(() => {});
    await userEvent.click(screen.getByRole('button', { name: /Markera som Upptagen/ }));
    expect(openCamera).toHaveBeenCalled();
    expect(onUpdateStatus).not.toHaveBeenCalled();
  });

  it('keeps actions that are not allowed on this page disabled', () => {
    render(
      <PointActionModal
        point={makePoint()}
        onClose={() => {}}
        onUpdateStatus={vi.fn()}
        allowedActions={[...ALL]}
        disabledActions={['UPPTAGEN']}
      />
    );
    expect(screen.getByRole('button', { name: /Markera som Upptagen/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Markera som Ledig/ })).toBeEnabled();
  });

  it('stays open and explains when saving fails', async () => {
    const onClose = vi.fn();
    render(
      <PointActionModal
        point={makePoint({ status: 'KUNDORDER' })}
        onClose={onClose}
        onUpdateStatus={vi.fn().mockResolvedValue(false)}
        allowedActions={[...ALL]}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /Markera som Ledig/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('kunde inte sparas');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('locks limited changes while the rate limit is active', async () => {
    getLimitedChangeWait.mockResolvedValue(90);
    render(<PointActionModal point={makePoint({ status: 'SKRAP' })} onClose={() => {}} onUpdateStatus={vi.fn()} allowedActions={[...ALL]} />);
    // From Skräp, both Ledig and Upptagen are limited.
    const locked = await screen.findAllByRole('button', { name: /vänta 90 s/ });
    expect(locked).toHaveLength(2);
    locked.forEach((button) => expect(button).toBeDisabled());
    // Skräp -> Kundorder is not limited.
    expect(screen.getByRole('button', { name: /Plocka Kundorder/ })).toBeEnabled();
  });

  describe('with extra pallets allowed', () => {
    const upptagen = makePoint({ id: 'p1', status: 'UPPTAGEN' });

    it('registers the next pallet with its own photo and comment, not a status change', async () => {
      usePalletsStore.setState({ pallets: [pallet('x')], allowances: [allowance] });
      const onUpdateStatus = vi.fn();
      const onClose = vi.fn();
      render(
        <PointActionModal
          point={upptagen}
          onClose={onClose}
          onUpdateStatus={onUpdateStatus}
          allowedActions={[...ALL]}
          palletAccess={{ canPlace: true }}
        />
      );

      expect(screen.getByRole('button', { name: 'Markera som Upptagen (2/3)' })).toBeEnabled();
      await userEvent.type(screen.getByPlaceholderText('Lägg till noteringar...'), 'Grillkol');
      const photo = new File(['x'], 'pall.jpg', { type: 'image/jpeg' });
      await userEvent.upload(document.querySelector('input[type="file"]') as HTMLInputElement, photo);

      await waitFor(() => expect(placePallet).toHaveBeenCalledWith('p1', photo, 'Grillkol'));
      expect(onUpdateStatus).not.toHaveBeenCalled();
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('locks Upptagen when the point has as many pallets as allowed', () => {
      usePalletsStore.setState({ pallets: [pallet('x'), pallet('y'), pallet('z')], allowances: [allowance] });
      render(
        <PointActionModal point={upptagen} onClose={() => {}} onUpdateStatus={vi.fn()} allowedActions={[...ALL]} palletAccess={{ canPlace: true }} />
      );
      expect(screen.getByRole('button', { name: 'Fullt (3/3)' })).toBeDisabled();
    });

    it('allows no second pallet without a privilege', () => {
      usePalletsStore.setState({ pallets: [pallet('x')], allowances: [] });
      render(
        <PointActionModal point={upptagen} onClose={() => {}} onUpdateStatus={vi.fn()} allowedActions={[...ALL]} palletAccess={{ canPlace: true }} />
      );
      expect(screen.getByRole('button', { name: 'Upptagen (1/1)' })).toBeDisabled();
    });

    it('explains a pallet the database refused', async () => {
      usePalletsStore.setState({ pallets: [pallet('x')], allowances: [allowance] });
      placePallet.mockRejectedValue({ message: 'PALLET_LIMIT:3' });
      render(
        <PointActionModal point={upptagen} onClose={() => {}} onUpdateStatus={vi.fn()} allowedActions={[...ALL]} palletAccess={{ canPlace: true }} />
      );
      const photo = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
      await userEvent.upload(document.querySelector('input[type="file"]') as HTMLInputElement, photo);
      expect(await screen.findByRole('alert')).toHaveTextContent('Punkten är full (max 3 pallar).');
    });
  });

  it('closes with the X button', async () => {
    const onClose = vi.fn();
    render(<PointActionModal point={makePoint()} onClose={onClose} onUpdateStatus={vi.fn()} allowedActions={[...ALL]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Stäng' }));
    expect(onClose).toHaveBeenCalled();
  });
});
