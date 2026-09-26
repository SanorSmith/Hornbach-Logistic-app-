import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mock = await vi.hoisted(async () => (await import('../test/supabaseMock')).createSupabaseMock());
vi.mock('../lib/supabase', () => ({ supabase: mock.supabase }));
const createAppUser = vi.fn();
vi.mock('../lib/adminUsers', () => ({
  createAppUser: (...a: unknown[]) => createAppUser(...a),
  deleteAppUser: vi.fn(),
}));

import TeamManagement from './TeamManagement';
import { useAuthStore } from '../store/authStore';
import { User, UserRole } from '../types';

const person = (id: string, full_name: string, role: UserRole, is_active = true): User => ({
  id,
  email: `${id}@hornbach.se`,
  full_name,
  role,
  department_id: null,
  is_active,
  created_at: '2026-01-01T00:00:00Z',
  last_login: null,
});

const team = [
  person('me', 'Tina Teamledare', 'TEAM_LEADER'),
  person('boss', 'Anders Admin', 'ADMIN'),
  person('lf', 'Lars LineFeeder', 'LINEFEEDER'),
  person('old', 'Olle Slutat', 'LINEFEEDER', false),
];

function renderAs(viewer: User) {
  useAuthStore.setState({ user: viewer, isLoading: false });
  mock.respond('users', { data: team });
  mock.respond('departments', { data: [] });
  return render(
    <MemoryRouter>
      <TeamManagement />
    </MemoryRouter>
  );
}

const row = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

beforeEach(() => {
  mock.reset();
  createAppUser.mockReset();
});

describe('TeamManagement', () => {
  it('lists deactivated users so they can be activated again', async () => {
    renderAs(team[1]);
    expect(await screen.findByText('Olle Slutat')).toBeInTheDocument();
    expect(within(row('Olle Slutat')).getByRole('button', { name: 'Aktivera Olle Slutat' })).toBeInTheDocument();
  });

  it('does not let a team leader manage admins or offer the admin role', async () => {
    renderAs(team[0]);
    await screen.findByText('Anders Admin');
    expect(within(row('Anders Admin')).queryAllByRole('button')).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: /Ny användare|Lägg till/ }));
    // The dialog's role field (not the "Alla roller" filter at the top).
    const roleSelect = screen
      .getAllByRole('combobox')
      .find((el) => within(el).queryByText('LineFeeder') && !within(el).queryByText('Alla roller'))!;
    expect(within(roleSelect).queryByText('Admin')).toBeNull();
  });

  it('does not offer deactivating or deleting your own account', async () => {
    renderAs(team[0]);
    await screen.findByText('Tina Teamledare');
    const own = row('Tina Teamledare');
    expect(within(own).queryByRole('button', { name: /Inaktivera|Radera/ })).toBeNull();
    expect(within(own).getByRole('button', { name: 'Redigera Tina Teamledare' })).toBeInTheDocument();
  });

  it('creates a user only once on a double click', async () => {
    let finish: (v: unknown) => void = () => {};
    createAppUser.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderAs(team[1]);
    await userEvent.click(await screen.findByRole('button', { name: /Ny användare|Lägg till/ }));
    const inputs = screen.getAllByRole('textbox');
    await userEvent.type(inputs.find((i) => (i as HTMLInputElement).type === 'email')!, 'ny@hornbach.se');
    await userEvent.type(inputs.find((i) => (i as HTMLInputElement).type === 'text' && !(i as HTMLInputElement).placeholder.startsWith('Sök'))!, 'Ny Person');

    const create = screen.getByRole('button', { name: 'Skapa användare' });
    await userEvent.dblClick(create);
    expect(createAppUser).toHaveBeenCalledTimes(1);
    expect(create).toBeDisabled();
    finish({ temporary_password: 'x' });
  });
});
