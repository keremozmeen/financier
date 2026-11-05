import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { useSubRadar } from '../../hooks/useFinance';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';

/** One line for Sub-Radar (D19): the monthly cost and how many need a look. */
export function SubscriptionsRow() {
  const t = useT();
  const format = useFormat();
  const data = useSubRadar();
  if (!data || data.radar.subscriptions.length === 0) return null;
  const { radar } = data;
  const monthly = radar.totals
    .filter((total) => total.subscriptionsMonthly > 0)
    .map((total) => format.money(total.subscriptionsMonthly, total.currency))
    .join(' + ');
  const attention = radar.alerts.length;

  return (
    <Link to="/sub-radar" className="panel flex min-h-16 items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t('dashboard.subs.title')}</span>
        {attention > 0 && (
          <span className="block text-sm text-warn">
            {t('dashboard.subs.attention', { count: attention })}
          </span>
        )}
      </span>
      <span className="shrink-0 font-semibold">{t('radar.perMonth', { amount: monthly })}</span>
      <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-muted" />
    </Link>
  );
}
