import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { I18nProvider } from '../../i18n';
import { Dialog } from './Dialog';
import { currentDialogDepth } from './dialogHistory';

function Harness({ dismissOnBackdrop }: { dismissOnBackdrop?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && (
        <Dialog title="Sheet" onClose={() => setOpen(false)} dismissOnBackdrop={dismissOnBackdrop}>
          <input aria-label="Amount" />
          <button type="button">Inside</button>
        </Dialog>
      )}
    </>
  );
}

function renderDialog(props: { dismissOnBackdrop?: boolean } = {}) {
  return render(
    <I18nProvider>
      <Harness {...props} />
    </I18nProvider>,
  );
}

/** Waits until the history is back on a plain page (no dialog entry on top). */
async function historySettled() {
  await waitFor(() => expect(currentDialogDepth()).toBe(0));
}

const backdrop = () => screen.getByTestId('dialog-backdrop');

describe('Dialog', () => {
  afterEach(async () => {
    await historySettled();
  });

  it('pushes one history entry on open and removes it when closed with the X button', async () => {
    const before = window.history.length;
    renderDialog();
    expect(currentDialogDepth()).toBe(1);
    expect(window.history.length).toBe(before + 1);

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await historySettled();
  });

  it('closes on a tap on the backdrop but not on a tap inside the panel', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Inside' }));
    await userEvent.click(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await userEvent.click(backdrop());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the dialog open on a backdrop tap when backdrop dismissal is off', async () => {
    renderDialog({ dismissOnBackdrop: false });
    await userEvent.click(backdrop());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    renderDialog();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when the user goes back (swipe-back, Android back, browser back)', async () => {
    renderDialog();
    act(() => window.history.back());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(currentDialogDepth()).toBe(0);
  });

  it('can be opened again after closing, with exactly one entry each time', async () => {
    renderDialog();
    const withFirst = window.history.length;
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await historySettled();
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(currentDialogDepth()).toBe(1);
    // The second entry replaces the forward entry the first one left behind.
    expect(window.history.length).toBe(withFirst);
    act(() => window.history.back());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps the modal semantics, focuses the first field and locks page scroll', async () => {
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Sheet' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.body.style.overflow).toBe('');
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
  });

  it('returns focus to what opened it', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await historySettled();
    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(opener).toHaveFocus();
  });

  it('labels the close button in Turkish too', async () => {
    window.localStorage.setItem('financier.locale', 'tr');
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Kapat' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
