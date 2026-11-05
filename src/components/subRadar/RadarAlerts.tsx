import { ChevronDown } from 'lucide-react';
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

/**
 * One line that says how many things need a look, opening to the alerts (D19, D20): notable
 * price increases, double charges and charges after a cancellation.
 */
export function RadarAlerts({
  alerts,
  actions,
}: {
  alerts: readonly RadarAlert[];
  actions: AlertActions;
}) {
  const t = useT();
  const format = useFormat();
  if (alerts.length === 0) return null;

  return (
    <details className="group rounded-[1.125rem] bg-alert-soft">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 font-medium [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-alert" />
        <span className="flex-1">{t('radar.attention', { count: alerts.length })}</span>
        <ChevronDown
          aria-hidden="true"
          size={16}
          className="shrink-0 text-muted transition-transform group-open:rotate-180"
        />
      </summary>
      <ul className="divide-y divide-alert/20 px-4 pb-2">
        {alerts.map((alert) => {
          const { item } = alert;
          const money = (amount: number) => format.money(amount, item.currency);
          if (alert.kind === 'increase') {
            const { from, to } = alert.increase;
            return (
              <li key={`increase-${item.key}`} className="space-y-2 py-3">
                <p className="text-sm">
                  {t('radar.alert.increase', {
                    name: item.name,
                    diff: money(to - from),
                    from: money(from),
                    to: money(to),
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
              <li key={`double-${second.id}`} className="space-y-2 py-3">
                <p className="text-sm">
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
            <li key={`cancel-${item.key}`} className="space-y-2 py-3">
              <p className="text-sm">
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
    </details>
  );
}
