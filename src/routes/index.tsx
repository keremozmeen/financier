import { Navigate, type RouteObject } from 'react-router';
import { AppShell } from '../components/AppShell';
import { AddTransactionScreen } from './AddTransactionScreen';
import { CardDetailScreen } from './CardDetailScreen';
import { EditCardScreen, NewCardScreen } from './CardFormScreen';
import { CardsScreen } from './CardsScreen';
import { DashboardScreen } from './DashboardScreen';
import { SettingsScreen } from './SettingsScreen';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardScreen /> },
      { path: 'cards', element: <CardsScreen /> },
      { path: 'cards/new', element: <NewCardScreen /> },
      { path: 'cards/:id', element: <CardDetailScreen /> },
      { path: 'cards/:id/edit', element: <EditCardScreen /> },
      { path: 'cards/:id/add', element: <AddTransactionScreen /> },
      {
        path: 'import',
        // Loaded with the tab: CSV parsing, and SheetJS on demand, stay out of the main bundle (D18).
        lazy: async () => ({ Component: (await import('./ImportScreen')).ImportScreen }),
      },
      {
        path: 'sub-radar',
        // Its own chunk, like the import screen, so the main bundle stays under the limit.
        lazy: async () => ({ Component: (await import('./SubRadarScreen')).SubRadarScreen }),
      },
      { path: 'settings', element: <SettingsScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
