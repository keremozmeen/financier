import { TrendingUp } from 'lucide-react';
import type { Cadence, RadarItem } from '../../core/subscriptions';
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
  onConfirm: (item: RadarItem) => void;
  onIgnore: (item: RadarItem) => void;
  onCancel: (item: RadarItem) => void;
  onRestore: (item: RadarItem) => void;
}

/** One list of subscriptions or bills, each with its cost, dates, charges and actions (D19). */
export function SeriesList({
  title,
  items,
  cardById,
  actions,
  cancelledAt,
}: {
  title: string;
  items: readonly RadarItem[];
  cardById: ReadonlyMap<string, Card>;
  actions: SeriesActions;
  /** For the Cancelled list: the stored cancellation date per series. */
  cancelledAt?: ReadonlyMap<string, string>;
}) {
  const t = useT();
  const format = useFormat();
  if (items.length === 0) return null;
  const id = `radar-${title.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-2 text-sm font-medium text-muted">
        {title}
      </h2>
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {items.map((item) => {
          const card = cardById.get(item.latest.cardId);
          const money = (amount: number) => format.money(amount, item.currency);
          const bill = item.kind === 'bill';
          const hidden = item.state === 'ignored' || item.state === 'cancelled';
          const cancelled = cancelledAt?.get(item.key);
          return (
            <li key={item.key} className="space-y-2 p-4">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: card?.color ?? 'currentColor' }}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="truncate">{item.name}</span>
                    {item.state === 'detected' && (
                      <span className="rounded bg-surface-raised px-1.5 py-0.5 text-xs text-accent">
                        {t('radar.badge.detected')}
                      </span>
                    )}
                    {item.increase && !hidden && !bill && (
                      <span className="inline-flex items-center gap-1 rounded bg-alert/15 px-1.5 py-0.5 text-xs text-alert">
                        <TrendingUp aria-hidden="true" size={12} />
                        {t('radar.badge.increase')}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {[
                      t(CADENCE[item.cadence]),
                      card?.name,
                      t('radar.meta.last', { date: format.date(item.latest.date) }),
                      cancelled
                        ? t('radar.meta.cancelled', { date: format.date(cancelled) })
                        : item.active && t('radar.meta.next', { date: format.date(item.nextDate) }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums">
                    {bill
                      ? t('radar.perMonth', { amount: money(item.amount) })
                      : t(PER[item.cadence], { amount: money(item.amount) })}
                  </p>
                  {!bill && item.cadence !== 'monthly' && (
                    <p className="text-xs text-muted tabular-nums">
                      {t('radar.aboutPerMonth', { amount: money(item.monthly) })}
                    </p>
                  )}
                </div>
              </div>
              <details className="pl-5.5 text-sm">
                <summary className="inline-flex min-h-11 cursor-pointer items-center text-muted">
                  {t('radar.history', { count: item.charges.length })}
                </summary>
                <ul className="mt-1 space-y-1 text-muted">
                  {[...item.charges].reverse().map((charge) => (
                    <li key={charge.id} className="flex justify-between gap-3 tabular-nums">
                      <span>{format.date(charge.date)}</span>
                      <span>{money(charge.amount)}</span>
                    </li>
                  ))}
                </ul>
              </details>
              <div className="flex flex-wrap gap-2 pl-5.5">
                {hidden ? (
                  <Button onClick={() => actions.onRestore(item)}>
                    {t('radar.action.restore')}
                  </Button>
                ) : (
                  <>
                    {item.state === 'detected' && (
                      <Button onClick={() => actions.onConfirm(item)}>
                        {t('radar.action.confirm')}
                      </Button>
                    )}
                    <Button onClick={() => actions.onCancel(item)}>
                      {t('radar.action.cancel')}
                    </Button>
                    <Button variant="ghost" onClick={() => actions.onIgnore(item)}>
                      {t('radar.action.ignore')}
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
