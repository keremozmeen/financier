import { CalendarClock, Check } from 'lucide-react';
import type { Bill } from '../../core/finance';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import type { CreditCard } from '../../types/domain';
import { Button } from '../ui/Button';

/** A credit card's next statement with its due date and a "Mark as paid" action (D14). */
export function NextBill({
  card,
  bill,
  onMarkPaid,
}: {
  card: CreditCard;
  bill: Bill;
  onMarkPaid: () => void;
}) {
  const t = useT();
  const format = useFormat();

  return (
    <section
      aria-label={t('bill.title')}
      className="space-y-3 rounded-xl border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-medium text-muted">{t('bill.title')}</h2>
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
        {bill.paidAmount > 0 && (
          <p className="text-muted">
            {t('bill.paidSoFar', { amount: format.money(bill.paidAmount, card.currency) })}
          </p>
        )}
      </div>
      {bill.remaining > 0 ? (
        <Button variant="primary" className="w-full" onClick={onMarkPaid}>
          <Check aria-hidden="true" size={18} />
          {t('bill.markPaid')}
        </Button>
      ) : (
        <p className="text-sm text-muted">{t('bill.nothingDue')}</p>
      )}
    </section>
  );
}
