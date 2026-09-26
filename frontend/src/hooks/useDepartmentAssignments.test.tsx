import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';

const mock = await vi.hoisted(async () => (await import('../test/supabaseMock')).createSupabaseMock());
vi.mock('../lib/supabase', () => ({ supabase: mock.supabase }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toast }));

import { useDepartmentAssignments } from './useDepartmentAssignments';

const TABLE = 'department_point_assignments';
const selects = () => mock.calls.filter((c) => c.table === TABLE && c.method === 'select').length;

beforeEach(() => {
  mock.reset();
  toast.error.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('useDepartmentAssignments', () => {
  it('loads the assignments on mount', async () => {
    mock.respond(TABLE, { data: [{ point_id: 'p1', department_number: '12', department_id: 'd1' }] });
    const { result } = renderHook(() => useDepartmentAssignments());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.assignments).toEqual({ p1: '12' });
    expect(result.current.assignedDepartments).toEqual({ p1: 'd1' });
    expect(selects()).toBe(1);
  });

  it('refetch loads the assignments again', async () => {
    mock.respond(TABLE, { data: [{ point_id: 'p1', department_number: '12', department_id: 'd1' }] });
    const { result } = renderHook(() => useDepartmentAssignments());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mock.respond(TABLE, { data: [{ point_id: 'p1', department_number: '14', department_id: 'd2' }] });
    await act(async () => {
      await result.current.refetch();
    });
    expect(selects()).toBe(2);
    expect(result.current.assignments).toEqual({ p1: '14' });
    expect(result.current.assignedDepartments).toEqual({ p1: 'd2' });
  });

  it('loads only once under StrictMode', async () => {
    mock.respond(TABLE, { data: [] });
    const { result } = renderHook(() => useDepartmentAssignments(), { wrapper: StrictMode });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(selects()).toBe(1);
  });

  it('tells the user when the assignments cannot be loaded', async () => {
    mock.respond(TABLE, { error: { message: 'JWT expired' } });
    const { result } = renderHook(() => useDepartmentAssignments());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.assignments).toEqual({});
    expect(toast.error).toHaveBeenCalledWith('Kunde inte hämta avdelningsnummer');
  });
});
