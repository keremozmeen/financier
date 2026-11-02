import { BellRing } from 'lucide-react';
import { useToday } from '../../hooks/useFinance';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import type { UpcomingBill } from '../../db';
import { dueWhen } from './dueLabel';

/** Overdue payments and those due within 7 days, shown every time the dashboard opens (D5, D14). */
export function DueSoonBanner({ items }: { items: readonly UpcomingBill[] }) {
  const t = useT();
  const format = useFormat();
  const today = useToday();
  if (items.length === 0) return null;

  return (
    <section
      aria-label={t('due.banner.title')}
      className="flex gap-3 rounded-xl border border-warn/40 bg-warn/10 p-4"
    >
      <BellRing aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-warn" />
      <div className="min-w-0 space-y-1">
        <h2 className="font-semibold">{t('due.banner.title')}</h2>
        <ul className="space-y-0.5 text-sm">
          {items.map(({ card, bill, overdue }) => (
            <li key={`${card.id}:${bill.periodEnd}`} className={overdue ? 'text-alert' : ''}>
              {overdue
                ? t('due.overdueItem', {
                    card: card.name,
                    amount: format.money(bill.remaining, card.currency),
                    date: format.date(bill.dueDate),
                  })
                : t('due.item', {
                    card: card.name,
                    amount: format.money(bill.remaining, card.currency),
                    when: dueWhen(t, today, bill.dueDate),
                  })}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
