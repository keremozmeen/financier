import { useCallback } from 'react';
import { buildDueDateCalendar } from '../../core/finance';
import type { UpcomingBill } from '../../db';
import { useToday } from '../../hooks/useFinance';
import { useT } from '../../i18n';
import { downloadTextFile } from '../../platform/download';

/** Downloads a local .ics file with each credit card's monthly due date (D5). */
export function useCalendarExport(bills: readonly UpcomingBill[]) {
  const t = useT();
  const today = useToday();
  return useCallback(() => {
    // A card can be listed twice (an overdue bill and its next bill); one event each.
    const cards = [...new Map(bills.map(({ card }) => [card.id, card])).values()];
    const ics = buildDueDateCalendar(cards, today, new Date(), {
      summary: (name) => t('calendar.summary', { name }),
      description: t('calendar.description'),
    });
    downloadTextFile('financier-due-dates.ics', ics, 'text/calendar;charset=utf-8');
  }, [bills, today, t]);
}
