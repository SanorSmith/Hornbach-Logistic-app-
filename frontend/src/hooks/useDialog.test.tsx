import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useDialog } from './useDialog';

function Dialog({ label, onClose, children }: { label: string; onClose: () => void; children?: React.ReactNode }) {
  const ref = useDialog(true, onClose);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
      {children}
    </div>
  );
}

describe('useDialog', () => {
  it('closes with Escape and moves focus into the dialog', async () => {
    const onClose = vi.fn();
    render(<Dialog label="Test" onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Test' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('only closes the top-most dialog', async () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    render(
      <Dialog label="Outer" onClose={closeOuter}>
        <Dialog label="Inner" onClose={closeInner} />
      </Dialog>
    );
    await userEvent.keyboard('{Escape}');
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
  });

  it('gives focus back to the button that opened it', async () => {
    function Page() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Öppna</button>
          {open && <Dialog label="Test" onClose={() => setOpen(false)} />}
        </>
      );
    }
    render(<Page />);
    await userEvent.click(screen.getByRole('button', { name: 'Öppna' }));
    expect(screen.getByRole('dialog')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Öppna' })).toHaveFocus();
  });
});
