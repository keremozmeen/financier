import { daysBetween } from '../../core/finance';
import type { I18nValue } from '../../i18n/context';
import type { IsoDate } from '../../types/domain';

/** "today", "tomorrow" or "in N days" for a due date. */
export function dueWhen(t: I18nValue['t'], today: IsoDate, dueDate: IsoDate): string {
  const days = daysBetween(today, dueDate);
  if (days === 0) return t('due.today');
  if (days === 1) return t('due.tomorrow');
  return t('due.inDays', { count: days });
}
