import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { I18nProvider } from '../i18n';
import { routes } from '../routes';
import { ThemeProvider } from '../theme/ThemeProvider';

/** Renders the whole app at `path` with an in-memory router. */
export function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const result = render(
    <ThemeProvider>
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>
    </ThemeProvider>,
  );
  return { ...result, router };
}
