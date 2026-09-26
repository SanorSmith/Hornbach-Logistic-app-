import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RedPointGrid from './RedPointGrid';
import { HOUR, makePoint } from '../../test/fixtures';

const ago = (h: number) => new Date(Date.now() - h * HOUR).toISOString();

describe('RedPointGrid', () => {
  const ledig = makePoint({ id: 'l', status: 'LEDIG' });
  const busyNew = makePoint({ id: 'bn', status: 'UPPTAGEN', status_changed_at: ago(2) });
  const busyOld = makePoint({ id: 'bo', status: 'UPPTAGEN', status_changed_at: ago(30) });
  const kundorder = makePoint({ id: 'k', status: 'KUNDORDER' });
  const names = { l: 'J1', bn: 'J2', bo: 'J3', k: 'KASSA' };

  it('shows Kundorder first and the oldest Upptagen before newer ones', () => {
    render(<RedPointGrid points={[ledig, busyNew, busyOld, kundorder]} onPointClick={() => {}} assignments={names} />);
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(['KASSA', 'J3', 'J2', 'J1']);
  });

  it('flags only Upptagen points older than 24 h', () => {
    render(<RedPointGrid points={[busyNew, busyOld]} onPointClick={() => {}} assignments={names} />);
    expect(screen.getAllByText(/Över 24 h/)).toHaveLength(1);
    const oldCard = screen.getByRole('heading', { name: 'J3' }).closest('div.relative') as HTMLElement;
    expect(within(oldCard).getByText(/Över 24 h/)).toBeInTheDocument();
  });

  it('falls back to the point number when a point has no name', () => {
    const unnamed = makePoint({ id: 'u', point_number: 42 });
    render(<RedPointGrid points={[unnamed]} onPointClick={() => {}} assignments={{}} />);
    expect(screen.getByRole('heading', { name: '#42' })).toBeInTheDocument();
  });

  it('opens the point when a card is clicked', async () => {
    const onPointClick = vi.fn();
    render(<RedPointGrid points={[kundorder]} onPointClick={onPointClick} assignments={names} />);
    await userEvent.click(screen.getByRole('heading', { name: 'KASSA' }));
    expect(onPointClick).toHaveBeenCalledWith(kundorder);
  });

  it('can be used from the keyboard', async () => {
    const onPointClick = vi.fn();
    render(<RedPointGrid points={[busyOld]} onPointClick={onPointClick} assignments={names} />);
    const card = screen.getByRole('button', { name: 'Punkt J3, Upptagen, över 24 timmar' });
    card.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onPointClick).toHaveBeenCalledTimes(2);
  });
});
