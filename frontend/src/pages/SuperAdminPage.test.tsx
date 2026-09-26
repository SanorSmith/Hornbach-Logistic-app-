import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const fetchFacilityOverview = vi.fn();
const deleteFacility = vi.fn();
const createFacility = vi.fn();
vi.mock('../lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock('../lib/facilities', () => ({
  fetchFacilityOverview: () => fetchFacilityOverview(),
  updateFacility: vi.fn(),
}));
vi.mock('../lib/adminUsers', () => ({
  createFacility: (...args: unknown[]) => createFacility(...args),
  createFacilityAdmin: vi.fn(),
  deleteAppUser: vi.fn(),
  deleteFacility: (...args: unknown[]) => deleteFacility(...args),
}));

import SuperAdminPage from './SuperAdminPage';

const store = (code: string, name: string) => ({
  id: `f-${code}`,
  code,
  name,
  location: null,
  address: null,
  phone: null,
  is_active: true,
  created_at: '',
  user_count: 3,
  point_count: 60,
  department_count: 17,
  admins: [],
});

beforeEach(() => {
  fetchFacilityOverview.mockReset().mockResolvedValue([store('772', 'Norsborg'), store('773', 'Kungens Kurva')]);
  deleteFacility.mockReset().mockResolvedValue({ deleted: true, users: 3, photos: 0 });
  createFacility.mockReset();
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <SuperAdminPage />
    </MemoryRouter>
  );

describe('SuperAdminPage', () => {
  it('lists the stores', async () => {
    renderPage();
    expect(await screen.findByText('HORNBACH 772 Norsborg')).toBeInTheDocument();
    expect(screen.getByText('HORNBACH 773 Kungens Kurva')).toBeInTheDocument();
  });

  it('only deletes a store after its number is typed', async () => {
    renderPage();
    const card = (await screen.findByText('HORNBACH 773 Kungens Kurva')).closest('article') as HTMLElement;
    await userEvent.click(within(card).getByRole('button', { name: /Radera/ }));

    const confirm = screen.getByRole('button', { name: 'Radera butiken permanent' });
    const input = screen.getByLabelText(/Skriv butiksnumret 773/);
    expect(confirm).toBeDisabled();

    await userEvent.type(input, '772');
    expect(confirm).toBeDisabled();

    await userEvent.clear(input);
    await userEvent.type(input, '773');
    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);
    expect(deleteFacility).toHaveBeenCalledWith('f-773', '773');
  });

  it('creates a store with its admin', async () => {
    createFacility.mockResolvedValue({ facility_id: 'f-774', temporary_password: 'Temp1234abcd' });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Ny butik/ }));

    await userEvent.type(screen.getByLabelText(/Butiksnr/), '774');
    await userEvent.type(screen.getAllByLabelText(/^Namn/)[0], 'Häggvik');
    await userEvent.type(screen.getAllByLabelText(/^Namn/)[1], 'Bo Boss');
    await userEvent.type(screen.getByLabelText(/E-post/), 'Bo@Example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Skapa butik och admin' }));

    expect(createFacility).toHaveBeenCalledWith(
      expect.objectContaining({ code: '774', name: 'Häggvik' }),
      expect.objectContaining({ email: 'Bo@Example.com', full_name: 'Bo Boss', password: undefined })
    );
    expect(await screen.findByText('Temp1234abcd')).toBeInTheDocument();
    expect(screen.getByText('bo@example.com')).toBeInTheDocument();
  });
});
