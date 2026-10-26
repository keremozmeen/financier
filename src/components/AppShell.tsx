import { Outlet } from 'react-router';
import { useT } from '../i18n';
import { TabBar } from './TabBar';

export function AppShell() {
  const t = useT();
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4">
          <img src={`${import.meta.env.BASE_URL}kipp.svg`} alt="" className="size-8 rounded-lg" />
          <span className="text-lg font-semibold tracking-tight">{t('app.name')}</span>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
