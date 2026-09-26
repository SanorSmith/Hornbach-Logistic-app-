import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mock = await vi.hoisted(async () => (await import('../test/supabaseMock')).createSupabaseMock());
vi.mock('../lib/supabase', () => ({ supabase: mock.supabase }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toast }));

import TeamLeaderDashboard from './TeamLeaderDashboard';

function renderDashboard() {
  return render(
    <MemoryRouter>
      <TeamLeaderDashboard />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mock.reset();
  toast.error.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('TeamLeaderDashboard', () => {
  it('shows the point stats', async () => {
    mock.respond('red_points', { data: [{ status: 'LEDIG' }, { status: 'UPPTAGEN' }] });
    mock.respond('users', { data: [{ is_active: true }] }); // active users
    renderDashboard();
    expect(await screen.findByText('Aktiva Användare')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('tells the team leader when the stats cannot be loaded instead of showing zeros', async () => {
    mock.respond('red_points', { error: { message: 'JWT expired' } });
    renderDashboard();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Fel vid hämtning av data'));
  });
});
