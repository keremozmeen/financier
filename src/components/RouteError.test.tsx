import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { I18nProvider } from '../i18n';
import { routes } from '../routes';

it('offers a reload instead of the raw error when a screen fails to load', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const failing: RouteObject = {
    index: true,
    lazy: async () => {
      throw new TypeError('Failed to fetch dynamically imported module');
    },
  };
  const router = createMemoryRouter([
    { path: '/', errorElement: routes[0]!.errorElement, children: [failing] } as RouteObject,
  ]);
  render(
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>,
  );

  expect(await screen.findByRole('heading', { name: "This screen didn't open" })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Reload' })).toBeVisible();
  expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
  consoleError.mockRestore();
});
