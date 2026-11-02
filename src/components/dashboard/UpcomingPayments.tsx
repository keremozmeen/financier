import { CalendarPlus, Check } from 'lucide-react';
import { useState } from 'react';
import { buildDueDateCalendar, type Bill } from '../../core/finance';
import { paymentsRepo } from '../../db';
import { useToday } from '../../hooks/useFinance';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import { downloadTextFile } from '../../platform/download';
import type { CreditCard } from '../../types/domain';
import { PaymentForm } from '../cards/PaymentForm';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';

/** Each credit card's next bill with "Mark as paid", plus the calendar export (D5, D14). */
export function UpcomingPayments({
  bills,
}: {
  bills: readonly { card: CreditCard; bill: Bill }[];
}) {
  const t = useT();
  const format = useFormat();
  const today = useToday();
  const [paying, setPaying] = useState<{ card: CreditCard; bill: Bill }>();

  if (bills.length === 0) return null;

  function exportCalendar() {
    const ics = buildDueDateCalendar(
      bills.map(({ card }) => card),
      today,
      new Date(),
      {
        summary: (name) => t('calendar.summary', { name }),
        description: t('calendar.description'),
      },
    );
    downloadTextFile('financier-due-dates.ics', ics, 'text/calendar;charset=utf-8');
  }

  return (
    <section aria-labelledby="upcoming-title">
      <h2 id="upcoming-title" className="mb-2 text-sm font-medium text-muted">
        {t('dashboard.upcoming.title')}
      </h2>
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {bills.map(({ card, bill }) => (
          <li key={card.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{card.name}</p>
              <p className="text-xs text-muted">
                {t('bill.due', { date: format.date(bill.dueDate) })}
                {bill.dueMoved && ` · ${t('bill.moved')}`}
              </p>
            </div>
            {bill.remaining > 0 ? (
              <>
                <span className="shrink-0 font-semibold whitespace-nowrap tabular-nums">
                  {format.money(bill.remaining, card.currency)}
                </span>
                <Button
                  className="w-full sm:w-auto"
                  aria-label={`${t('bill.markPaid')}: ${card.name}`}
                  onClick={() => setPaying({ card, bill })}
                >
                  <Check aria-hidden="true" size={18} />
                  {t('bill.markPaid')}
                </Button>
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
