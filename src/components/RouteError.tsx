import { RefreshCw } from 'lucide-react';
import { useT } from '../i18n';
import { Button } from './ui/Button';

/** Shown when a screen fails to load, for example a file gone after an app update. */
export function RouteError() {
  const t = useT();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-display text-[1.625rem] font-bold tracking-tight">
        {t('app.error.title')}
      </h1>
      <Button variant="primary" onClick={() => window.location.reload()}>
        <RefreshCw aria-hidden="true" size={18} />
        {t('app.error.reload')}
      </Button>
    </main>
  );
}
