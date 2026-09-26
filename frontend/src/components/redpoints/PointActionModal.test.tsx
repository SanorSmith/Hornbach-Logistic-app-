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
}));
vi.mock('../../hooks/usePointDetails', () => ({
  usePointDetails: () => ({ name: 'T3', departmentName: 'Trädgård', departmentLocation: 'Botkyrka' }),
}));
vi.mock('./PointImageGallery', () => ({ default: () => <div>gallery</div> }));

import PointActionModal from './PointActionModal';
import { makePoint } from '../../test/fixtures';

const ALL = ['LEDIG', 'UPPTAGEN', 'SKRAP', 'KUNDORDER'] as const;

beforeEach(() => {
  getLimitedChangeWait.mockReset().mockResolvedValue(0);
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

  it('closes with the X button', async () => {
    const onClose = vi.fn();
    render(<PointActionModal point={makePoint()} onClose={onClose} onUpdateStatus={vi.fn()} allowedActions={[...ALL]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Stäng' }));
    expect(onClose).toHaveBeenCalled();
  });
});
