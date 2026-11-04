import { ChevronDown } from 'lucide-react';
import type { Cadence, RadarItem } from '../../core/subscriptions';
import { useToday } from '../../hooks/useFinance';
import { useFormat } from '../../hooks/useFormat';
import { useT, type MessageKey } from '../../i18n';
import type { Card } from '../../types/domain';
import { Button } from '../ui/Button';

const PER: Record<Cadence, MessageKey> = {
  weekly: 'radar.perWeek',
  monthly: 'radar.perMonth',
  yearly: 'radar.perYear',
};

const CADENCE: Record<Cadence, MessageKey> = {
  weekly: 'radar.cadence.weekly',
  monthly: 'radar.cadence.monthly',
  yearly: 'radar.cadence.yearly',
};

export interface SeriesActions {
  onIgnore: (item: RadarItem) => void;
  onCancel: (item: RadarItem) => void;
  onRestore: (item: RadarItem) => void;
}

/**
 * One subscription or bill (D19, D20): its name and price, and everything else (the bank's
 * text, dates, price change, charges, actions) behind a tap.
 */
export function SeriesRow({
  item,
  card,
  actions,
  attention,
  cancelledAt,
}: {
  item: RadarItem;
  card: Card | undefined;
  actions: SeriesActions;
  /** It has an alert waiting: shown as a red dot. */
  attention: boolean;
  cancelledAt?: string;
}) {
  const t = useT();
  const format = useFormat();
  const today = useToday();
  const money = (amount: number) => format.money(amount, item.currency);
  const bill = item.kind === 'bill';
  const hidden = item.state !== 'active';
  const increase = item.increase;

  const status = cancelledAt
    ? t('radar.meta.cancelled', { date: format.date(cancelledAt) })
    : item.active && !hidden && item.nextDate >= today
      ? t('radar.meta.next', { date: format.date(item.nextDate) })
      : t('radar.meta.last', { date: format.date(item.latest.date) });

  return (
    <li>
      <details className="group">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 hover:bg-surface-raised [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: card?.color ?? 'currentColor' }}
          />
          <span className="min-w-0 flex-1 font-medium break-words">
            {item.name}
            {attention && (
              <span className="ml-2 inline-block size-2 rounded-full bg-alert align-middle">
                <span className="sr-only">{t('radar.attention.dot')}</span>
              </span>
            )}
          </span>
          <span className="shrink-0 text-right font-semibold tabular-nums">
            {bill
              ? t('radar.aboutPerMonth', { amount: money(item.amount) })
              : t(PER[item.cadence], { amount: money(item.amount) })}
          </span>
          <ChevronDown
            aria-hidden="true"
            size={16}
            className="shrink-0 text-muted transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="space-y-3 px-4 pb-4 pl-9.5 text-sm">
          <p className="text-muted">
            {[t(CADENCE[item.cadence]), card?.name, status].filter(Boolean).join(' · ')}
          </p>
          {!bill && item.cadence !== 'monthly' && (
            <p className="text-muted">
              {t('radar.equalsPerMonth', { amount: money(item.monthly) })}
            </p>
          )}
          {increase && (
            <p className={increase.notable ? 'font-medium text-alert' : 'text-muted'}>
              {t(increase.notable ? 'radar.change.notable' : 'radar.change.small', {
                diff: money(increase.to - increase.from),
                from: money(increase.from),
                to: money(increase.to),
              })}
            </p>
          )}
          <div>
            <p className="text-xs text-muted">{t('radar.recent')}</p>
            <ul className="mt-1 space-y-1">
              {[...item.charges]
                .reverse()
                .slice(0, 6)
                .map((charge) => (
                  <li key={charge.id} className="flex justify-between gap-3 tabular-nums">
                    <span className="text-muted">{format.date(charge.date)}</span>
                    <span>{money(charge.amount)}</span>
                  </li>
                ))}
            </ul>
          </div>
          <p className="text-xs break-words text-muted">
            {t('radar.bankText', { text: item.bankText })}
          </p>
          <div className="flex flex-wrap gap-2">
            {hidden ? (
              <Button onClick={() => actions.onRestore(item)}>{t('radar.action.restore')}</Button>
            ) : (
              <>
                <Button onClick={() => actions.onCancel(item)}>{t('radar.action.cancel')}</Button>
                <Button variant="ghost" onClick={() => actions.onIgnore(item)}>
                  {t(bill ? 'radar.action.ignoreBill' : 'radar.action.ignore')}
                </Button>
              </>
            )}
          </div>
        </div>
      </details>
    </li>
  );
}
