import { TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import type { RadarAlert } from '../../core/subscriptions';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import { Button } from '../ui/Button';

export interface AlertActions {
  onAcknowledge: (alert: Extract<RadarAlert, { kind: 'increase' }>) => void;
  onNotDouble: (alert: Extract<RadarAlert, { kind: 'double' }>) => void;
  onStillActive: (alert: Extract<RadarAlert, { kind: 'afterCancel' }>) => void;
  onDismissAfterCancel: (alert: Extract<RadarAlert, { kind: 'afterCancel' }>) => void;
}

/** Red alerts: price increases, double charges and charges after a cancellation (D19). */
export function RadarAlerts({
  alerts,
  actions,
}: {
  alerts: readonly RadarAlert[];
  actions: AlertActions;
}) {
  const t = useT();
  const format = useFormat();
  // Small raises matter (D19), so the percentage keeps one decimal: +0,2%, not +0%.
  const percent = useMemo(
    () => new Intl.NumberFormat(format.locale, { style: 'percent', maximumFractionDigits: 1 }),
    [format.locale],
  );
  if (alerts.length === 0) return null;

  return (
    <section
      aria-labelledby="radar-alerts"
      className="rounded-xl border border-alert/40 bg-alert/10 p-4"
    >
      <h2 id="radar-alerts" className="mb-2 flex items-center gap-2 font-semibold text-alert">
        <TriangleAlert aria-hidden="true" size={18} />
        {t('radar.alerts.title')}
      </h2>
      <ul className="divide-y divide-alert/20">
        {alerts.map((alert) => {
          const { item } = alert;
          const money = (amount: number) => format.money(amount, item.currency);
          if (alert.kind === 'increase') {
            const { from, to } = alert.increase;
            return (
              <li key={`increase-${item.key}`} className="space-y-2 py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium">
                  {t('radar.alert.increase', {
                    name: item.name,
                    from: money(from),
                    to: money(to),
                    diff: money(to - from),
                    percent: percent.format((to - from) / from),
                  })}
                </p>
                <Button onClick={() => actions.onAcknowledge(alert)}>
                  {t('radar.action.gotIt')}
                </Button>
              </li>
            );
          }
          if (alert.kind === 'double') {
            const { first, second } = alert.double;
            return (
              <li key={`double-${second.id}`} className="space-y-2 py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium">
                  {t('radar.alert.double', {
                    name: item.name,
                    amount: money(second.amount),
                    first: format.date(first.date),
                    second: format.date(second.date),
                  })}
                </p>
                <Button onClick={() => actions.onNotDouble(alert)}>
                  {t('radar.action.notDouble')}
                </Button>
              </li>
            );
          }
          return (
            <li key={`cancel-${item.key}`} className="space-y-2 py-3 first:pt-0 last:pb-0">
              <p className="text-sm font-medium">
                {t('radar.alert.afterCancel', {
                  name: item.name,
                  amount: money(alert.charge.amount),
                  date: format.date(alert.charge.date),
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => actions.onStillActive(alert)}>
                  {t('radar.action.stillActive')}
                </Button>
                <Button variant="ghost" onClick={() => actions.onDismissAfterCancel(alert)}>
                  {t('radar.action.dismiss')}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
