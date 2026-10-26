import { useT, type MessageKey } from '../i18n';

export function PlaceholderScreen({ title }: { title: MessageKey }) {
  const t = useT();
  return (
    <section>
      <h1 className="text-2xl font-semibold">{t(title)}</h1>
      <p className="mt-3 rounded-xl border border-border bg-surface p-4 text-muted">
        {t('placeholder.comingSoon')}
      </p>
    </section>
  );
}
