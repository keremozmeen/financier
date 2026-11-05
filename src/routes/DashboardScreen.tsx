import { CreditCard, Plus } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import { CardTitle } from '../components/cards/CardTitle';
import { CardUsagePanel } from '../components/cards/CardUsagePanel';
import { DueSoonBanner } from '../components/dashboard/DueSoonBanner';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { UpcomingPayments } from '../components/dashboard/UpcomingPayments';
import { ButtonLink } from '../components/ui/Button';
import { dueSoon } from '../core/finance';
import { useDashboard, useToday } from '../hooks/useFinance';
import { useT } from '../i18n';

// Recharts is large; load it in its own chunk so the app shell stays small.
const CashFlowChart = lazy(() => import('../components/dashboard/CashFlowChart'));

export function DashboardScreen() {
  const t = useT();
  const today = useToday();
  const dashboard = useDashboard();

  return (
    <section className="space-y-5">
      <h1 className="font-display text-[1.625rem] font-bold tracking-tight">
        {t('nav.dashboard')}
      </h1>
      {dashboard === undefined ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : dashboard.summaries.length === 0 ? (
        <div className="panel p-6 text-center">
          <CreditCard aria-hidden="true" className="mx-auto text-muted" size={32} />
          <h2 className="mt-3 font-semibold">{t('dashboard.empty.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('dashboard.empty.body')}</p>
          <ButtonLink to="/cards/new" variant="primary" className="mt-4">
            <Plus aria-hidden="true" size={18} />
            {t('cards.add')}
          </ButtonLink>
        </div>
      ) : (
        <>
          <DueSoonBanner items={dueSoon(dashboard.bills, today)} />
          <div>
            <h2 className="mb-2 text-sm font-medium text-muted">{t('dashboard.gaugesTitle')}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {dashboard.summaries.map((summary) => (
                <li key={summary.card.id}>
                  <Link
                    to={`/cards/${summary.card.id}`}
                    className="block panel p-4 transition-colors hover:border-muted"
                  >
                    <CardTitle card={summary.card} as="h3" />
                    <div className="mt-3">
                      <CardUsagePanel summary={summary} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <UpcomingPayments bills={dashboard.bills} />
          {dashboard.bills.length > 0 && (
            <Suspense fallback={<div className="h-80" />}>
              <CashFlowChart projections={dashboard.projections} />
            </Suspense>
          )}
          <RecentActivity items={dashboard.recent} />
        </>
      )}
    </section>
  );
}
