import { CreditCard, Plus } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import { CardTitle } from '../components/cards/CardTitle';
import { CardUsagePanel } from '../components/cards/CardUsagePanel';
import { CardTiles } from '../components/dashboard/CardTiles';
import { DuePanel } from '../components/dashboard/DuePanel';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { SubscriptionsRow } from '../components/dashboard/SubscriptionsRow';
import { UpcomingPayments } from '../components/dashboard/UpcomingPayments';
import { ButtonLink } from '../components/ui/Button';
import { useDetailedView } from '../hooks/useDetailedView';
import { useDashboard, useToday } from '../hooks/useFinance';
import { useFormat } from '../hooks/useFormat';
import { useT } from '../i18n';

// Recharts is large; load it in its own chunk so the app shell stays small.
const CashFlowChart = lazy(() => import('../components/dashboard/CashFlowChart'));

/** Recent entries on the simple dashboard; the detailed view shows all it loads (D20). */
const SIMPLE_RECENT = 3;

/**
 * The dashboard (D20, D21): what is due in the next 30 days first, then the cards, the
 * subscriptions and the latest spending. The detailed view adds every card's gauge, the
 * full payments list with its actions and the cash-flow chart.
 */
export function DashboardScreen() {
  const t = useT();
  const format = useFormat();
  const today = useToday();
  const dashboard = useDashboard();
  const [detailed] = useDetailedView();

  return (
    <section className="space-y-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-[1.625rem] font-bold tracking-tight">
          {t('nav.dashboard')}
        </h1>
        <p className="text-sm text-muted">{format.dayMonth(today)}</p>
      </div>
      {dashboard === undefined ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : dashboard.summaries.length === 0 ? (
        <div className="panel p-6 text-center">
          <CreditCard aria-hidden="true" className="mx-auto text-muted" size={32} />
          <h2 className="mt-3 font-display text-lg font-bold">{t('dashboard.empty.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('dashboard.empty.body')}</p>
          <ButtonLink to="/cards/new" variant="primary" className="mt-4">
            <Plus aria-hidden="true" size={18} />
            {t('cards.add')}
          </ButtonLink>
        </div>
      ) : (
        <>
          {dashboard.bills.length > 0 && (
            <DuePanel bills={dashboard.bills} showCalendar={!detailed} />
          )}
          {detailed ? (
            <div>
              <h2 className="mb-3 font-display text-lg font-bold tracking-tight">
                {t('dashboard.gaugesTitle')}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {dashboard.summaries.map((summary) => (
                  <li key={summary.card.id}>
                    <Link to={`/cards/${summary.card.id}`} className="panel block p-4">
                      <CardTitle card={summary.card} as="h3" />
                      <div className="mt-3">
                        <CardUsagePanel summary={summary} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <CardTiles summaries={dashboard.summaries} />
          )}
          <SubscriptionsRow />
          {detailed && <UpcomingPayments bills={dashboard.bills} />}
          {detailed && dashboard.bills.length > 0 && (
            <Suspense fallback={<div className="h-80" />}>
              <CashFlowChart projections={dashboard.projections} />
            </Suspense>
          )}
          <RecentActivity
            items={detailed ? dashboard.recent : dashboard.recent.slice(0, SIMPLE_RECENT)}
          />
        </>
      )}
    </section>
  );
}
