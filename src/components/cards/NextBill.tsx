import { CalendarClock, Check, CircleAlert } from 'lucide-react';
import type { CardBill } from '../../core/finance';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import type { CreditCard } from '../../types/domain';
import { Button } from '../ui/Button';

/**
 * A credit card bill with its due date and a "Mark as paid" action (D14). An overdue
 * bill is flagged and can also be settled with "Paid outside the app".
 */
export function NextBill({
  card,
  item,
  onMarkPaid,
  onPaidOutside,
}: {
  card: CreditCard;
  item: CardBill;
  onMarkPaid: () => void;
  onPaidOutside: () => void;
}) {
  const t = useT();
  const format = useFormat();
  const { bill, overdue } = item;
  const title = overdue ? t('bill.overdueTitle') : t('bill.title');

  return (
    <section
      aria-label={title}
      className={`space-y-3 rounded-xl border bg-surface p-4 ${overdue ? 'border-alert/60' : 'border-border'}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          className={`flex items-center gap-2 text-sm font-medium ${overdue ? 'text-alert' : 'text-muted'}`}
        >
          {overdue && <CircleAlert aria-hidden="true" size={16} />}
          {title}
        </h2>
        <p className="text-2xl font-semibold whitespace-nowrap tabular-nums">
          {format.money(bill.remaining, card.currency)}
        </p>
      </div>
      <div className="space-y-1 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <CalendarClock aria-hidden="true" size={16} className="shrink-0 text-muted" />
          {t('bill.due', { date: format.date(bill.dueDate) })}
        </p>
        {bill.dueMoved && <p className="text-muted">{t('bill.moved')}</p>}
        <p className="text-muted">
          {t('bill.period', {
            start: format.date(bill.periodStart),
            end: format.date(bill.periodEnd),
          })}
        </p>
        {bill.creditApplied > 0 && (
          <p className="text-success">
            {t('bill.creditApplied', { amount: format.money(bill.creditApplied, card.currency) })}
          </p>
        )}
        {bill.paidAmount > 0 && (
          <p className="text-muted">
            {t('bill.paidSoFar', { amount: format.money(bill.paidAmount, card.currency) })}
          </p>
        )}
      </div>
      {bill.remaining > 0 ? (
        <div className={overdue ? 'grid gap-2 sm:grid-cols-2' : ''}>
          <Button variant="primary" className="w-full" onClick={onMarkPaid}>
            <Check aria-hidden="true" size={18} />
            {t('bill.markPaid')}
          </Button>
          {overdue && (
            <Button className="w-full" onClick={onPaidOutside}>
              {t('bill.paidOutside')}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">{t('bill.nothingDue')}</p>
      )}
    </section>
  );
}
