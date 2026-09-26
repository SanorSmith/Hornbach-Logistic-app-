import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import { createAppUser, createFacility, deleteAppUser, deleteFacility } from './adminUsers';

beforeEach(() => invoke.mockReset());

const functionError = (message: string) => ({
  data: null,
  error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: message }) } },
});

describe('createAppUser', () => {
  it('rejects invalid emails before calling the server', async () => {
    await expect(createAppUser({ email: 'anna @hornbach.se', full_name: 'Anna', role: 'LINEFEEDER' })).rejects.toThrow(
      /Ogiltig e-postadress/
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it('sends a trimmed, lower-case email', async () => {
    invoke.mockResolvedValue({ data: { user: { id: 'u1' }, temporary_password: 'abc' }, error: null });
    const result = await createAppUser({ email: '  Anna@Hornbach.SE ', full_name: 'Anna', role: 'LINEFEEDER' });
    expect(invoke).toHaveBeenCalledWith('admin-users', {
      body: expect.objectContaining({ action: 'create', email: 'anna@hornbach.se', role: 'LINEFEEDER' }),
    });
    expect(result.temporary_password).toBe('abc');
  });

  it('shows the server error in Swedish', async () => {
    invoke.mockResolvedValue(functionError('A user with this email address has already been registered'));
    await expect(createAppUser({ email: 'a@b.se', full_name: 'A', role: 'MONITOR' })).rejects.toThrow(
      'Det finns redan ett konto med den e-postadressen.'
    );
  });

  it('passes other server errors through', async () => {
    invoke.mockResolvedValue(functionError('Okänd avdelning'));
    await expect(createAppUser({ email: 'a@b.se', full_name: 'A', role: 'DEPARTMENT' })).rejects.toThrow('Okänd avdelning');
  });
});

describe('deleteAppUser', () => {
  it('reports when a user was deactivated instead of deleted', async () => {
    invoke.mockResolvedValue({ data: { deactivated: true }, error: null });
    await expect(deleteAppUser('u1')).resolves.toEqual({ deactivated: true });
    expect(invoke).toHaveBeenCalledWith('admin-users', { body: { action: 'delete', user_id: 'u1' } });
  });
});

describe('facilities (super admin)', () => {
  it('creates a store together with its admin', async () => {
    invoke.mockResolvedValue({ data: { facility_id: 'f1' }, error: null });
    await createFacility({ code: '774', name: 'Häggvik' }, { email: 'Bo@X.se', full_name: 'Bo' });
    expect(invoke).toHaveBeenCalledWith('admin-users', {
      body: {
        action: 'create_facility',
        facility: { code: '774', name: 'Häggvik' },
        admin: { email: 'bo@x.se', full_name: 'Bo' },
      },
    });
  });

  it('sends the typed store number with a delete', async () => {
    invoke.mockResolvedValue({ data: { deleted: true, users: 2, photos: 1 }, error: null });
    await deleteFacility('f1', '774');
    expect(invoke).toHaveBeenCalledWith('admin-users', {
      body: { action: 'delete_facility', facility_id: 'f1', confirm_code: '774' },
    });
  });
});
