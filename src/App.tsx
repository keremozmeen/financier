import { createHashRouter, RouterProvider } from 'react-router';
import { UpdatePrompt } from './components/UpdatePrompt';
import { I18nProvider } from './i18n';
import { routes } from './routes';
import { ThemeProvider } from './theme/ThemeProvider';

// Hash routing keeps deep links working on GitHub Pages without server rewrites.
const router = createHashRouter(routes);

export function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <RouterProvider router={router} />
        <UpdatePrompt />
      </I18nProvider>
    </ThemeProvider>
  );
}
