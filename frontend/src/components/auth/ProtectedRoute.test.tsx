import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../lib/supabase', () => ({ supabase: { auth: {} } }));

import ProtectedRoute from './ProtectedRoute';
import { useAuthStore } from '../../store/authStore';
import { User, UserRole } from '../../types';

const user = (role: UserRole, extra: Partial<User> = {}): User => ({
  id: 'u1',
  email: 'test@example.com',
  full_name: 'Test',
  role,
  department_id: null,
  is_active: true,
  created_at: '',
  last_login: null,
  ...extra,
});

function renderAt(path: string, roles?: UserRole[]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
        <Route path="/change-password" element={<p>Change password page</p>} />
        <Route path="/" element={<p>Start page</p>} />
        <Route path="/linefeeder" element={<p>LineFeeder home</p>} />
        <Route path="/department" element={<p>Department home</p>} />
        <Route path="/superadmin" element={<p>Super admin home</p>} />
        <Route
          path="/reports"
          element={
            <ProtectedRoute roles={roles}>
              <p>Reports page</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  useAuthStore.setState({ user: null, supabaseUser: null, isLoading: false });
});

describe('ProtectedRoute', () => {
  it('shows a spinner while the session loads', () => {
    useAuthStore.setState({ isLoading: true });
    const { container } = renderAt('/reports');
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('sends signed-out visitors to the login page', () => {
    renderAt('/reports');
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('sends deactivated accounts to the login page', () => {
    useAuthStore.setState({ user: user('ADMIN', { is_active: false }) });
    renderAt('/reports');
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('forces a password change for temporary passwords', () => {
    useAuthStore.setState({ user: user('ADMIN', { must_change_password: true }) });
    renderAt('/reports');
    expect(screen.getByText('Change password page')).toBeInTheDocument();
  });

  it('lets allowed roles in', () => {
    useAuthStore.setState({ user: user('TEAM_LEADER') });
    renderAt('/reports', ['ADMIN', 'TEAM_LEADER']);
    expect(screen.getByText('Reports page')).toBeInTheDocument();
  });

  it('sends other roles to their own start page', () => {
    useAuthStore.setState({ user: user('LINEFEEDER') });
    renderAt('/reports', ['ADMIN', 'TEAM_LEADER']);
    expect(screen.getByText('LineFeeder home')).toBeInTheDocument();
  });

  it('sends the super admin to the store panel', () => {
    useAuthStore.setState({ user: user('SUPER_ADMIN') });
    renderAt('/reports', ['ADMIN', 'TEAM_LEADER']);
    expect(screen.getByText('Super admin home')).toBeInTheDocument();
  });
});
