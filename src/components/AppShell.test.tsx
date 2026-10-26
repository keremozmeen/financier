import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { I18nProvider } from '../i18n';
import { routes } from '../routes';
import { ThemeProvider } from '../theme/ThemeProvider';

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <ThemeProvider>
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>
    </ThemeProvider>,
  );
}

describe('AppShell', () => {
  it('shows the five tabs and navigates between them', async () => {
    renderApp();
    const nav = screen.getByRole('navigation');
    for (const name of ['Dashboard', 'Cards', 'Import', 'Sub-Radar', 'Settings']) {
      expect(nav).toContainElement(screen.getByRole('link', { name }));
    }

    await userEvent.click(screen.getByRole('link', { name: 'Cards' }));
    expect(screen.getByRole('heading', { name: 'Cards' })).toBeInTheDocument();
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

    await userEvent.click(screen.getByRole('button', { name: 'Açık' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
