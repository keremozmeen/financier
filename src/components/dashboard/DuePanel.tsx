import { CalendarPlus, Check, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  daysBetween,
  dueUrgency,
  dueWithin,
  totalsByCurrency,
  type DueUrgency,
} from '../../core/finance';
import { paymentsRepo, type UpcomingBill } from '../../db';
import { useToday } from '../../hooks/useFinance';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import { PaymentForm } from '../cards/PaymentForm';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { leaveDialogHistory } from '../ui/dialogHistory';
import { useCalendarExport } from './useCalendarExport';

const TAG_CLASS: Record<DueUrgency, string> = {
  overdue: 'bg-alert-soft text-alert',
  soon: 'bg-warn-soft text-warn',
  later: 'bg-surface-raised text-muted',
  auto: 'bg-surface-raised text-muted',
};

/**
 * What the dashboard leads with (D20): the total due in the next 30 days and the list
 * of those payments, red only when overdue and amber within 2 days of the due date.
 * Tapping a payment opens its actions.
 */
export function DuePanel({
  bills,
  showCalendar,
}: {
  bills: readonly UpcomingBill[];
  /** The detailed view has its own calendar button under the full list. */
  showCalendar: boolean;
}) {
  const t = useT();
  const format = useFormat();
  const today = useToday();
  const exportCalendar = useCalendarExport(bills);
  const [open, setOpen] = useState<UpcomingBill>();
  const due = dueWithin(bills, today);
  const total = totalsByCurrency(due)
    .map(({ amount, currency }) => format.money(amount, currency))
    .join(' + ');

  function tag(item: UpcomingBill): string {
    const urgency = dueUrgency(item, today);
    if (urgency === 'overdue') return t('due.tag.overdue');
    if (urgency === 'auto') return t('due.tag.auto');
    const days = daysBetween(today, item.bill.dueDate);
    if (days === 0) return t('due.tag.today');
    if (days === 1) return t('due.tag.tomorrow');
    if (urgency === 'soon') return t('due.tag.inDays', { count: days });
    return format.dayMonth(item.bill.dueDate);
  }

  return (
    <section aria-labelledby="due-title" className="panel p-5">
      <h2 id="due-title" className="text-sm text-muted">
        {t('dashboard.due.title')}
      </h2>
      {due.length === 0 ? (
        <p className="mt-2 text-sm">{t('dashboard.due.none')}</p>
      ) : (
        <>
          <p className="mt-1 font-display text-[2.5rem] leading-tight font-bold tracking-tight">
            {total}
          </p>
          <ul className="mt-3">
            {due.map((item) => {
              const label = tag(item);
              const amount = format.money(item.bill.remaining, item.card.currency);
              return (
                <li key={`${item.card.id}:${item.bill.periodEnd}`}>
                  <button
                    type="button"
                    aria-label={t('dashboard.due.row', {
                      card: item.card.name,
                      amount,
                      when: label,
                    })}
                    onClick={() => setOpen(item)}
                    className="flex min-h-12 w-full items-center gap-3 text-left"
                  >
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${TAG_CLASS[dueUrgency(item, today)]}`}
                    >
                      {label}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.card.name}</span>
                    <span className="shrink-0 font-semibold">{amount}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {showCalendar && bills.length > 0 && (
        <Button variant="ghost" className="mt-2 -ml-3" onClick={exportCalendar}>
          <CalendarPlus aria-hidden="true" size={18} />
          {t('calendar.add')}
        </Button>
      )}

      {open && <BillDialog item={open} onClose={() => setOpen(undefined)} />}
    </section>
  );
}

/** A payment's actions: mark it paid, settle an overdue one outside the app, or open the card. */
function BillDialog({ item, onClose }: { item: UpcomingBill; onClose: () => void }) {
  const t = useT();
  const format = useFormat();
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const { card, bill, overdue, autoPay } = item;

  return (
    <Dialog title={card.name} onClose={onClose} dismissOnBackdrop={!paying}>
      {paying ? (
        <PaymentForm
          bare
          card={card}
          bill={bill}
          onCancel={() => setPaying(false)}
          onSubmit={async (amount, date) => {
            await paymentsRepo.record(card, bill, amount, date);
            onClose();
          }}
        />
      ) : (
        <>
          <div>
            <p className="font-display text-3xl font-bold tracking-tight">
              {format.money(bill.remaining, card.currency)}
            </p>
            <p className={`text-sm ${overdue ? 'text-alert' : 'text-muted'}`}>
              {overdue
                ? t('due.overdueSince', { date: format.date(bill.dueDate) })
                : t('bill.due', { date: format.date(bill.dueDate) })}
              {bill.dueMoved && ` · ${t('bill.moved')}`}
            </p>
          </div>
          {autoPay ? (
            <p className="flex items-center gap-2 text-sm font-medium text-success">
              <Check aria-hidden="true" size={16} />
              {t('bill.autoPay')}
            </p>
          ) : (
            <div className="grid gap-2">
              <Button variant="primary" onClick={() => setPaying(true)}>
                <Check aria-hidden="true" size={18} />
                {t('bill.markPaid')}
              </Button>
              {overdue && (
                <Button
                  onClick={async () => {
                    await paymentsRepo.markPaidOutside(card, bill);
                    onClose();
                  }}
                >
                  {t('bill.paidOutside')}
                </Button>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            onClick={async () => {
              const left = leaveDialogHistory();
              onClose();
              await left;
              await navigate(`/cards/${card.id}`);
            }}
          >
            {t('dashboard.due.openCard')}
            <ChevronRight aria-hidden="true" size={18} />
          </Button>
        </>
      )}
    </Dialog>
  );
}
