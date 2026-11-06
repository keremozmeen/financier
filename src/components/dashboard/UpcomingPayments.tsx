import { CalendarPlus, Check, CircleAlert } from 'lucide-react';
import { useState } from 'react';
import type { Bill } from '../../core/finance';
import { paymentsRepo, type UpcomingBill } from '../../db';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import type { CreditCard } from '../../types/domain';
import { PaymentForm } from '../cards/PaymentForm';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { useCalendarExport } from './useCalendarExport';

/**
 * Overdue bills and each credit card's next bill with "Mark as paid", plus the
 * calendar export (D5, D14).
 */
export function UpcomingPayments({ bills }: { bills: readonly UpcomingBill[] }) {
  const t = useT();
  const format = useFormat();
  const exportCalendar = useCalendarExport(bills);
  const [paying, setPaying] = useState<{ card: CreditCard; bill: Bill }>();

  if (bills.length === 0) return null;
  return (
    <section aria-labelledby="upcoming-title">
      <h2 id="upcoming-title" className="mb-3 font-display text-lg font-bold tracking-tight">
        {t('dashboard.upcoming.title')}
      </h2>
      <ul className="divide-y divide-border panel">
        {bills.map(({ card, bill, overdue, autoPay }) => (
          <li
            key={`${card.id}:${bill.periodEnd}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{card.name}</p>
              <p className="text-xs text-muted">
                {t('bill.due', { date: format.date(bill.dueDate) })}
                {bill.dueMoved && ` · ${t('bill.moved')}`}
              </p>
              {overdue && (
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-alert">
                  <CircleAlert aria-hidden="true" size={14} />
                  {t('bill.overdue')}
                </p>
              )}
            </div>
            {bill.remaining > 0 && autoPay ? (
              <>
                <span className="shrink-0 font-semibold whitespace-nowrap tabular-nums">
                  {format.money(bill.remaining, card.currency)}
                </span>
                <p className="flex w-full items-center gap-1 text-sm font-medium text-success sm:w-auto">
                  <Check aria-hidden="true" size={16} />
                  {t('bill.autoPay')}
                </p>
              </>
            ) : bill.remaining > 0 ? (
              <>
                <span className="shrink-0 font-semibold whitespace-nowrap tabular-nums">
                  {format.money(bill.remaining, card.currency)}
                </span>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <Button
                    className="flex-1 sm:flex-none"
                    aria-label={`${t('bill.markPaid')}: ${card.name}`}
                    onClick={() => setPaying({ card, bill })}
                  >
                    <Check aria-hidden="true" size={18} />
                    {t('bill.markPaid')}
                  </Button>
                  {overdue && (
                    <Button
                      variant="ghost"
                      className="flex-1 sm:flex-none"
                      aria-label={`${t('bill.paidOutside')}: ${card.name}`}
                      onClick={() => void paymentsRepo.markPaidOutside(card, bill)}
                    >
                      {t('bill.paidOutside')}
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <span className="shrink-0 text-sm text-muted">{t('dashboard.upcoming.none')}</span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 space-y-1">
        <Button variant="ghost" onClick={exportCalendar}>
          <CalendarPlus aria-hidden="true" size={18} />
          {t('calendar.add')}
        </Button>
        <p className="text-xs text-muted">{t('calendar.help')}</p>
      </div>

      {paying && (
        <Dialog
          title={`${t('payment.title')}: ${paying.card.name}`}
          onClose={() => setPaying(undefined)}
          dismissOnBackdrop={false}
        >
          <PaymentForm
            bare
            card={paying.card}
            bill={paying.bill}
            onCancel={() => setPaying(undefined)}
            onSubmit={async (amount, date) => {
              await paymentsRepo.record(paying.card, paying.bill, amount, date);
              setPaying(undefined);
            }}
          />
        </Dialog>
      )}
    </section>
  );
}
