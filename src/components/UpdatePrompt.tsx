import { useRegisterSW } from 'virtual:pwa-register/react';
import { useT } from '../i18n';

/** Shows a toast when the service worker has a new version waiting. */
export function UpdatePrompt() {
  const t = useT();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-surface-raised p-3 shadow-lg"
    >
      <p className="flex-1 text-sm">
        {needRefresh ? t('pwa.updateAvailable') : t('pwa.offlineReady')}
      </p>
      {needRefresh && (
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg"
        >
          {t('pwa.reload')}
        </button>
      )}
      <button type="button" onClick={close} className="min-h-11 rounded-lg px-3 text-sm text-muted">
        {t('pwa.dismiss')}
      </button>
    </div>
  );
}
