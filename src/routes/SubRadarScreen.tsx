import { Radar as RadarIcon, TrendingUp } from 'lucide-react';
import { RadarAlerts, type AlertActions } from '../components/subRadar/RadarAlerts';
import { SeriesList, type SeriesActions } from '../components/subRadar/SeriesList';
import type { RadarTotals } from '../core/subscriptions';
import { subscriptionsRepo } from '../db';
import { useSubRadar, useToday } from '../hooks/useFinance';
import { useFormat } from '../hooks/useFormat';
import { useT } from '../i18n';

/** Sub-Radar (D19): subscriptions and bills across credit and debit cards. */
export function SubRadarScreen() {
  const t = useT();
  const today = useToday();
  const data = useSubRadar();

  const seriesActions: SeriesActions = {
    onConfirm: (item) => void subscriptionsRepo.confirm(item),
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

  const { radar, cardById } = data;
  const more = radar.inactive.length + radar.cancelled.length + radar.ignored.length;
  const empty = radar.subscriptions.length + radar.bills.length + more === 0;

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">{t('nav.subRadar')}</h1>
      {empty ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <RadarIcon aria-hidden="true" className="mx-auto text-muted" size={32} />
          <h2 className="mt-3 font-semibold">{t('radar.empty.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('radar.empty.body')}</p>
        </div>
      ) : (
        <>
          {radar.totals.length > 0 && <Summary totals={radar.totals} />}
          <RadarAlerts alerts={radar.alerts} actions={alertActions} />
          <SeriesList
            title={t('radar.section.subscriptions')}
            items={radar.subscriptions}
            cardById={cardById}
            actions={seriesActions}
          />
          <SeriesList
            title={t('radar.section.bills')}
            items={radar.bills}
            cardById={cardById}
            actions={seriesActions}
          />
          {more > 0 && (
            <details className="space-y-4">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-muted">
                {t('radar.section.more', { count: more })}
              </summary>
              <div className="mt-2 space-y-5">
                <SeriesList
                  title={t('radar.section.inactive')}
                  items={radar.inactive}
                  cardById={cardById}
                  actions={seriesActions}
                />
                <SeriesList
                  title={t('radar.section.cancelled')}
                  items={radar.cancelled}
                  cardById={cardById}
                  actions={seriesActions}
                  cancelledAt={data.cancelledAt}
                />
                <SeriesList
                  title={t('radar.section.ignored')}
                  items={radar.ignored}
                  cardById={cardById}
                  actions={seriesActions}
                />
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function Summary({ totals }: { totals: readonly RadarTotals[] }) {
  const t = useT();
  const format = useFormat();
  const join = (pick: (total: RadarTotals) => number) =>
    totals
      .filter((total) => pick(total) > 0)
      .map((total) => format.money(pick(total), total.currency))
      .join(' + ');

  const monthly = join((total) => total.subscriptionsMonthly);
  const yearly = join((total) => total.subscriptionsYearly);
  const bills = join((total) => total.billsMonthly);
  const increases = join((total) => total.increasesMonthly);

  return (
    <section
      aria-label={t('radar.summary.title')}
      className="space-y-3 rounded-xl border border-border bg-surface p-4"
    >
      {monthly && (
        <div>
          <p className="text-sm text-muted">{t('radar.summary.subscriptions')}</p>
          <p className="text-xl font-semibold tabular-nums">
            {t('radar.perMonth', { amount: monthly })}
          </p>
          <p className="text-sm text-muted tabular-nums">
            {t('radar.perYear', { amount: yearly })}
          </p>
        </div>
      )}
      {bills && (
        <div>
          <p className="text-sm text-muted">{t('radar.summary.bills')}</p>
          <p className="font-semibold tabular-nums">{t('radar.perMonth', { amount: bills })}</p>
        </div>
      )}
      {increases && (
        <p className="flex items-center gap-2 text-sm font-semibold text-alert">
          <TrendingUp aria-hidden="true" size={16} />
          {t('radar.summary.increases', { amount: increases })}
        </p>
      )}
    </section>
  );
}
