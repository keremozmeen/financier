import { Outlet } from 'react-router';
import { useAutoPay, useDueSoonBadge } from '../hooks/useFinance';
import { useT } from '../i18n';
import { TabBar } from './TabBar';

export function AppShell() {
  const t = useT();
  useAutoPay();
  useDueSoonBadge();
  return (
    <div className="min-h-dvh bg-bg text-fg">
      {/* Each screen's title is its heading; the app name is for assistive tech (D21). */}
      <p className="sr-only">{t('app.name')}</p>
      <main className="mx-auto max-w-xl px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
