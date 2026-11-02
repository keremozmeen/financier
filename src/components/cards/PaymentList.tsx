import { Trash2 } from 'lucide-react';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import type { Payment } from '../../types/domain';

/** Recorded bill payments, newest first, each removable (D14). */
export function PaymentList({
  payments,
  onDelete,
}: {
  payments: readonly Payment[];
  onDelete: (payment: Payment) => void;
}) {
  const t = useT();
  const format = useFormat();
  if (payments.length === 0) return null;

  return (
    <div>
      <h2 className="mb-2 text-sm font-medium text-muted">{t('payments.title')}</h2>
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {payments.map((payment) => {
          const label = `${t('payments.label')} ${format.date(payment.date)}`;
          return (
            <li key={payment.id} className="flex items-center gap-3 py-2 pr-1 pl-4">
              <p className="min-w-0 flex-1 truncate">{format.date(payment.date)}</p>
              <span className="shrink-0 font-semibold text-success tabular-nums">
                {format.money(payment.amount, payment.currency)}
              </span>
              <button
                type="button"
                onClick={() => onDelete(payment)}
                aria-label={`${t('common.delete')}: ${label}`}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-raised hover:text-alert"
              >
                <Trash2 aria-hidden="true" size={18} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
