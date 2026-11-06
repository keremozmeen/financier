import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cardsRepo } from '../db';
import { renderApp } from '../test/renderApp';
import { currentDialogDepth } from './ui/dialogHistory';

describe('AppShell', () => {
  it('shows four tabs around an Add button and navigates between them (D21)', async () => {
    renderApp();
    const nav = screen.getByRole('navigation');
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.getAttribute('aria-label')),
    ).toEqual(['Dashboard', 'Cards', 'Sub-Radar', 'Settings']);
    expect(within(nav).getByRole('button', { name: 'Add' })).toBeInTheDocument();
    // Only the current tab shows its name.
    expect(within(nav).getByText('Dashboard')).toBeInTheDocument();
    expect(within(nav).queryByText('Cards')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Cards' }));
    expect(screen.getByRole('heading', { name: 'Cards' })).toBeInTheDocument();
    expect(within(nav).getByText('Cards')).toBeInTheDocument();
  });

  it('opens the import screen from Add', async () => {
    renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    const sheet = screen.getByRole('dialog', { name: 'Add' });
    await userEvent.click(within(sheet).getByRole('button', { name: /Upload a statement/ }));
    expect(await screen.findByRole('heading', { name: 'Import' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('navigates exactly once from Add, and going back does not bring the sheet back', async () => {
    const { router } = renderApp('/cards');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(currentDialogDepth()).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: /Upload a statement/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/import'));
    // The sheet's own history entry is gone before the import page is pushed.
    expect(currentDialogDepth()).toBe(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe('/cards');
    expect(screen.getByRole('heading', { name: 'Cards' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the Add sheet when the route changes underneath it', async () => {
    const { router } = renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('dialog', { name: 'Add' })).toBeInTheDocument();
    await act(() => router.navigate('/settings'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(currentDialogDepth()).toBe(0));
    // Coming back to the page it was opened on does not reopen it.
    await act(() => router.navigate(-1));
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the Add sheet with the X, the backdrop and the back gesture', async () => {
    renderApp();
    const add = screen.getByRole('button', { name: 'Add' });

    await userEvent.click(add);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(currentDialogDepth()).toBe(0));

    await userEvent.click(add);
    await userEvent.click(screen.getByTestId('dialog-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(currentDialogDepth()).toBe(0));

    await userEvent.click(add);
    act(() => window.history.back());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('asks which card before adding an entry when there are several', async () => {
    const base = {
      bank: '',
      last4: '',
      currency: 'TRY',
      limit: 1_000_000,
      statementDay: 10,
      dueDay: 20,
      color: '#17694a',
    } as const;
    await cardsRepo.create({ type: 'credit', name: 'Axess', ...base });
    const bonus = await cardsRepo.create({ type: 'credit', name: 'Bonus', ...base });
    const { router } = renderApp();

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.click(screen.getByRole('button', { name: /Add an entry/ }));
    const sheet = screen.getByRole('dialog', { name: 'Which card?' });
    await userEvent.click(within(sheet).getByRole('button', { name: /Bonus/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/cards/${bonus}/add`));
    expect(currentDialogDepth()).toBe(0);
  });

  it('redirects unknown routes to the Dashboard', () => {
    renderApp('/does-not-exist');
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('switches language and theme from Settings', async () => {
    renderApp('/settings');

    await userEvent.click(screen.getByRole('button', { name: 'Türkçe' }));
    expect(screen.getByRole('heading', { name: 'Ayarlar' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('tr');
    expect(window.localStorage.getItem('financier.locale')).toBe('tr');

    await userEvent.click(screen.getByRole('button', { name: 'Koyu' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('financier.theme')).toBe('dark');
    await userEvent.click(screen.getByRole('button', { name: 'Açık' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
