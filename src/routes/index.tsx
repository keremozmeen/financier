import { Navigate, type RouteObject } from 'react-router';
import { AppShell } from '../components/AppShell';
import { PlaceholderScreen } from '../components/PlaceholderScreen';
import { SettingsScreen } from './SettingsScreen';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <PlaceholderScreen title="nav.dashboard" /> },
      { path: 'cards', element: <PlaceholderScreen title="nav.cards" /> },
      { path: 'import', element: <PlaceholderScreen title="nav.import" /> },
      { path: 'sub-radar', element: <PlaceholderScreen title="nav.subRadar" /> },
      { path: 'settings', element: <SettingsScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
