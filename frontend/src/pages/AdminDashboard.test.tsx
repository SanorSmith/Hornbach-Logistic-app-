import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mock = await vi.hoisted(async () => (await import('../test/supabaseMock')).createSupabaseMock());
vi.mock('../lib/supabase', () => ({ supabase: mock.supabase }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('../lib/qrPdf', () => ({ downloadAllPointsQrSheet: vi.fn() }));

import AdminDashboard from './AdminDashboard';
import { useAuthStore } from '../store/authStore';
import { User } from '../types';

const admin: User = {
  id: 'boss',
  email: 'boss@hornbach.se',
  full_name: 'Anders Admin',
  role: 'ADMIN',
  department_id: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  last_login: null,
};

function renderDashboard() {
  useAuthStore.setState({ user: admin, isLoading: false });
  return render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mock.reset();
  toast.error.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('AdminDashboard', () => {
  it('shows the user and department counts', async () => {
    mock.respond('users', { data: [admin, { ...admin, id: 'old', full_name: 'Olle Slutat', is_active: false }] });
    mock.respond('departments', { data: [{ id: 'd1', name: 'Bygg', location: 'A', is_active: true }] });
    renderDashboard();
    expect(await screen.findByText('1 aktiva')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('tells the admin when the data cannot be loaded instead of showing zeros', async () => {
    mock.respond('users', { error: { message: 'JWT expired' } });
    renderDashboard();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Fel vid hämtning av data'));
    // Nothing after the failed query is asked for.
    expect(mock.calls.some((c) => c.table === 'departments')).toBe(false);
  });
});
