import { ChevronDown, Radar as RadarIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { RadarAlerts, type AlertActions } from '../components/subRadar/RadarAlerts';
import { SeriesRow, type SeriesActions } from '../components/subRadar/SeriesRow';
import type { RadarItem, RadarTotals } from '../core/subscriptions';
import { subscriptionsRepo } from '../db';
import { useSubRadar, useToday } from '../hooks/useFinance';
import { useFormat } from '../hooks/useFormat';
import { useT } from '../i18n';

/**
 * Sub-Radar (D19, D20): one total, a short list of names and prices, and one line when
 * something needs a look. Details and actions open on tap.
 */
export function SubRadarScreen() {
  const t = useT();
  const today = useToday();
  const data = useSubRadar();
  const { money } = useFormat();

  const seriesActions: SeriesActions = {
    onIgnore: (item) => void subscriptionsRepo.ignore(item),
    onCancel: (item) => void subscriptionsRepo.cancel(item, today),
    onRestore: (item) => void subscriptionsRepo.restore(item),
  };
  const alertActions: AlertActions = {
    onAcknowledge: ({ item, increase }) =>
      void subscriptionsRepo.acknowledgeIncrease(item, increase.to),
    onNotDouble: ({ item, double }) => void subscriptionsRepo.dismissDouble(item, double.second.id),
    onStillActive: ({ item }) => void subscriptionsRepo.restore(item),
    // The cancellation moves to that charge, so only a later one alerts again.
    onDismissAfterCancel: ({ item, charge }) => void subscriptionsRepo.cancel(item, charge.date),
  };

  if (data === undefined) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">{t('nav.subRadar')}</h1>
        <p className="mt-3 text-muted">{t('common.loading')}</p>
      </section>
    );
  }

  const { radar, cardById, cancelledAt } = data;
  const past = [...radar.inactive, ...radar.cancelled, ...radar.ignored];
  const attention = new Set(radar.alerts.map((alert) => alert.item.key));
  const rows = (items: readonly RadarItem[]) =>
    items.map((item) => (
      <SeriesRow
        key={item.key}
        item={item}
        card={cardById.get(item.latest.cardId)}
        actions={seriesActions}
        attention={attention.has(item.key)}
        cancelledAt={item.state === 'cancelled' ? cancelledAt.get(item.key) : undefined}
      />
    ));

  if (radar.subscriptions.length + radar.bills.length + past.length === 0) {
    return (
      <section className="space-y-5">
        <h1 className="text-2xl font-semibold">{t('nav.subRadar')}</h1>
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <RadarIcon aria-hidden="true" className="mx-auto text-muted" size={32} />
          <h2 className="mt-3 font-semibold">{t('radar.empty.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('radar.empty.body')}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('nav.subRadar')}</h1>
      <Total totals={radar.totals} count={radar.subscriptions.length} />
      <RadarAlerts alerts={radar.alerts} actions={alertActions} />
      {radar.subscriptions.length > 0 && (
        <ul
          aria-label={t('radar.section.subscriptions')}
          className="divide-y divide-border rounded-xl border border-border bg-surface"
        >
          {rows(radar.subscriptions)}
        </ul>
      )}
      {radar.bills.length > 0 && (
        <Group
          title={t('radar.section.bills', {
            amount: joinMoney(radar.totals, (total) => total.billsMonthly, money),
          })}
        >
          {rows(radar.bills)}
        </Group>
      )}
      {past.length > 0 && (
        <Group title={t('radar.section.past', { count: past.length })} quiet>
          {rows(past)}
        </Group>
      )}
    </section>
  );
}

type MoneyFormat = (amount: number, currency: string) => string;

function joinMoney(
  totals: readonly RadarTotals[],
  pick: (total: RadarTotals) => number,
  money: MoneyFormat,
): string {
  return totals
    .filter((total) => pick(total) > 0)
    .map((total) => money(pick(total), total.currency))
    .join(' + ');
}

/** The one number that matters: what subscriptions cost per month. */
function Total({ totals, count }: { totals: readonly RadarTotals[]; count: number }) {
  const t = useT();
  const { money } = useFormat();
  const monthly = joinMoney(totals, (total) => total.subscriptionsMonthly, money);
  if (!monthly) return null;
  const yearly = joinMoney(totals, (total) => total.subscriptionsYearly, money);
  const increases = joinMoney(totals, (total) => total.increasesMonthly, money);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">{t('radar.total.label')}</p>
      <p className="text-2xl font-semibold tabular-nums">
        {t('radar.perMonth', { amount: monthly })}
      </p>
      <p className="mt-1 text-sm text-muted">
        {[
          t('radar.total.yearly', { amount: yearly }),
          t('radar.total.count', { count }),
          increases && t('radar.total.increases', { amount: increases }),
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  );
}

/** A folded group: bills, or the past and hidden ones. */
function Group({
  title,
  quiet = false,
  children,
}: {
  title: string;
  quiet?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="group">
      <summary
        className={`flex min-h-12 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden ${
          quiet
            ? 'text-sm text-muted'
            : 'rounded-xl border border-border bg-surface px-4 font-medium group-open:rounded-b-none'
        }`}
      >
        <span className="flex-1">{title}</span>
        <ChevronDown
          aria-hidden="true"
          size={16}
          className="shrink-0 text-muted transition-transform group-open:rotate-180"
        />
      </summary>
      <ul
        className={`divide-y divide-border border border-border bg-surface ${
          quiet ? 'rounded-xl' : 'rounded-b-xl border-t-0'
        }`}
      >
        {children}
      </ul>
    </details>
  );
}
