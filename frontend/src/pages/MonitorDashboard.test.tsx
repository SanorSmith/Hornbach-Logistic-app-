import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { makePoint } from '../test/fixtures';

const mock = await vi.hoisted(async () => (await import('../test/supabaseMock')).createSupabaseMock());
vi.mock('../lib/supabase', () => ({ supabase: mock.supabase }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toast }));

import MonitorDashboard from './MonitorDashboard';
import { useRedPointsStore } from '../store/redPointsStore';

beforeEach(() => {
  mock.reset();
  useRedPointsStore.setState({ points: [], isLoading: true, lastSyncedAt: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('MonitorDashboard', () => {
  it('keeps an open photo dialog in step with status changes from other devices', async () => {
    const point = makePoint({ id: 'p1', status: 'LEDIG' });
    mock.respond('red_points', { data: [point] });
    mock.respond('department_point_assignments', {
      data: [{ point_id: 'p1', department_number: 'J1', department_id: 'd1' }],
    });
    render(
      <MemoryRouter>
        <MonitorDashboard />
      </MemoryRouter>
    );

    await userEvent.click(await screen.findByRole('heading', { name: 'J1' }));
    const dialog = screen.getByRole('dialog', { name: /punkt J1/ });
    expect(within(dialog).getByText('Ledig')).toBeInTheDocument();

    // A realtime update arrives while the dialog is open.
    act(() => useRedPointsStore.getState().updatePoint({ ...point, status: 'KUNDORDER' }));
    expect(within(dialog).getByText('Kundorder')).toBeInTheDocument();
    expect(within(dialog).queryByText('Ledig')).not.toBeInTheDocument();
  });
});
