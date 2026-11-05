import { Link } from 'react-router';
import { matchBank } from '../../core/banks';
import type { CardSummary } from '../../db';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import { cardColor } from '../cards/colors';

/**
 * The cards as small tiles in their own color (D21): what is available on a credit
 * card, this month's spending on a debit card (D13). Scrolls sideways when they don't fit.
 */
export function CardTiles({ summaries }: { summaries: readonly CardSummary[] }) {
  const t = useT();
  const format = useFormat();

  return (
    <section aria-labelledby="tiles-title">
      <h2 id="tiles-title" className="mb-3 font-display text-lg font-bold tracking-tight">
        {t('dashboard.gaugesTitle')}
      </h2>
      <ul className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {summaries.map((summary) => {
          const { card } = summary;
          const bank = matchBank(card.bank, card.name);
          const credit = 'usage' in summary;
          return (
            <li key={card.id} className="shrink-0">
              <Link
                to={`/cards/${card.id}`}
                className="flex h-28 w-44 flex-col justify-between rounded-2xl p-3.5 text-white"
                style={{ backgroundColor: cardColor(card) }}
              >
                <span className="truncate text-[13px] opacity-90">
                  {[card.name, card.last4 || (bank && bank.name !== card.name ? bank.name : '')]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <span>
                  <span className="block text-xs opacity-90">
                    {credit ? t('gauge.available') : t('dashboard.tile.month')}
                  </span>
                  <span className="block font-display text-xl font-bold tracking-tight">
                    {format.money(
                      credit ? summary.usage.available : summary.monthSpending,
                      card.currency,
                    )}
                  </span>
                  {credit && summary.usage.utilization !== null && (
                    <span aria-hidden="true" className="mt-1.5 block h-1 rounded-full bg-white/25">
                      <span
                        className="block h-1 rounded-full bg-white"
                        style={{ width: `${Math.round(summary.usage.utilization * 100)}%` }}
                      />
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
