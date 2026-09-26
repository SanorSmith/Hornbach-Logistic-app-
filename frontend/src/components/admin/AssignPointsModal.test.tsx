import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mock = await vi.hoisted(async () => (await import('../../test/supabaseMock')).createSupabaseMock());
vi.mock('../../lib/supabase', () => ({ supabase: mock.supabase }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toast }));

import AssignPointsModal from './AssignPointsModal';

beforeEach(() => {
  mock.reset();
});

describe('AssignPointsModal', () => {
  it('gives every form control an accessible name', async () => {
    mock.respond('red_points', { data: [] });
    mock.respond('department_point_assignments', { data: [] });
    render(
      <AssignPointsModal isOpen onClose={() => {}} onSuccess={() => {}} departments={[{ id: 'd1', name: 'Bygg' }]} />
    );

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Avdelning' }), 'd1');

    expect(screen.getByRole('spinbutton', { name: 'Från nummer' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Till nummer' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Sök punkt' })).toBeInTheDocument();
  });
});
