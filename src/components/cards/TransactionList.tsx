import { Trash2 } from 'lucide-react';
import { useEntryLabel } from '../../hooks/useEntryLabel';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import type { InstallmentPlan, Transaction } from '../../types/domain';

export function TransactionList({
  transactions,
  plans,
  onDelete,
}: {
  transactions: readonly Transaction[];
  plans: readonly InstallmentPlan[];
  onDelete: (transaction: Transaction) => void;
}) {
  const t = useT();
  const format = useFormat();
  const entryLabel = useEntryLabel();
  const planCounts = new Map(plans.map((plan) => [plan.id, plan.count]));

  if (transactions.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-4 text-muted">{t('tx.empty')}</p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {transactions.map((tx) => {
        const count = tx.installmentPlanId ? planCounts.get(tx.installmentPlanId) : undefined;
        const refund = tx.amount < 0;
        const label = entryLabel(tx);
        return (
          <li key={tx.id} className="flex items-center gap-3 py-2 pr-1 pl-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{label}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <span>{format.date(tx.date)}</span>
                {count && (
                  <span className="rounded bg-surface-raised px-1.5 py-0.5">
                    {t('tx.badge.installments', { count })}
                  </span>
                )}
                {tx.income && (
                  <span className="rounded bg-surface-raised px-1.5 py-0.5 text-success">
                    {t('tx.badge.income')}
                  </span>
                )}
                {tx.bill && (
                  <span className="rounded bg-surface-raised px-1.5 py-0.5">
                    {t('tx.badge.bill')}
                  </span>
                )}
                {tx.fee && (
                  <span className="rounded bg-surface-raised px-1.5 py-0.5 text-warn">
                    {t('tx.badge.fee')}
                  </span>
                )}
                {/* Without a description the label already reads "Refund". */}
                {refund && !tx.income && tx.description.trim() && (
                  <span className="rounded bg-surface-raised px-1.5 py-0.5 text-success">
                    {t('tx.badge.refund')}
                  </span>
                )}
              </p>
            </div>
            <span className={`shrink-0 font-semibold tabular-nums ${refund ? 'text-success' : ''}`}>
              {format.money(tx.amount, tx.currency)}
            </span>
            <button
              type="button"
              onClick={() => onDelete(tx)}
              aria-label={`${t('common.delete')}: ${label}`}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-raised hover:text-alert"
            >
              <Trash2 aria-hidden="true" size={18} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
