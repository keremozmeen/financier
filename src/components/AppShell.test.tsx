import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cardsRepo } from '../db';
import { renderApp } from '../test/renderApp';

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
    expect(router.state.location.pathname).toBe(`/cards/${bonus}/add`);
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
