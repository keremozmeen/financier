import { Link } from 'react-router';
import { useEntryLabel } from '../../hooks/useEntryLabel';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import type { Card, Transaction } from '../../types/domain';

/** The latest entries on credit and debit cards together (D13). */
export function RecentActivity({
  items,
}: {
  items: readonly { transaction: Transaction; card: Card }[];
}) {
  const t = useT();
  const format = useFormat();
  const entryLabel = useEntryLabel();

  return (
    <section aria-labelledby="recent-title">
      <h2 id="recent-title" className="mb-2 text-sm font-medium text-muted">
        {t('dashboard.recent.title')}
      </h2>
      {items.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          {t('dashboard.recent.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {items.map(({ transaction: tx, card }) => (
            <li key={tx.id}>
              <Link
                to={`/cards/${card.id}`}
                className="flex min-h-11 items-center gap-3 px-4 py-2 hover:bg-surface-raised"
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: card.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{entryLabel(tx)}</p>
                  <p className="truncate text-xs text-muted">
                    {card.name} · {format.date(tx.date)}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-semibold tabular-nums ${tx.amount < 0 ? 'text-success' : ''}`}
                >
                  {format.money(tx.amount, tx.currency)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
