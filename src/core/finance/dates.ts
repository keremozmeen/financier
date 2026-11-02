import type { IsoDate, IsoMonth } from '../../types/domain';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function isIsoDate(value: string): value is IsoDate {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/** Today's date in the device's local time zone. */
export function todayIso(now: Date = new Date()): IsoDate {
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((n, i) => String(n).padStart(i === 0 ? 4 : 2, '0'))
    .join('-');
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

export function monthOf(date: IsoDate): IsoMonth {
  return date.slice(0, 7);
}

export function addMonths(month: IsoMonth, count: number): IsoMonth {
  const match = ISO_MONTH.exec(month);
  if (!match) throw new RangeError(`Invalid month: ${month}`);
  const index = Number(match[1]) * 12 + (Number(match[2]) - 1) + count;
  const year = Math.floor(index / 12);
  return `${String(year).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** A day-of-month setting (1–31) clamped to the real length of the month. */
export function clampDay(month: IsoMonth, day: number): number {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return Math.min(day, daysInMonth(y, m));
}

/**
 * Month of the first installment's payment for a purchase. The purchase lands on
 * the statement that closes on or after its date; that statement is due on `dueDay`
 * of the same month when the due day comes after the closing day, else the next month.
 */
export function firstDueMonth(
  purchaseDate: IsoDate,
  statementDay: number,
  dueDay: number,
): IsoMonth {
  return dueMonthFor(statementMonthFor(purchaseDate, statementDay), statementDay, dueDay);
}

/**
 * The next statement closing date (on or after `today`) and its payment due date.
 * Day settings are clamped to short months: a 31st closing day closes on the 30th
 * in a 30-day month and on the 28th or 29th in February.
 */
export function nextStatementDates(
  today: IsoDate,
  statementDay: number,
  dueDay: number,
): { statementDate: IsoDate; dueDate: IsoDate } {
  const statementMonth = statementMonthFor(today, statementDay);
  const dueMonth = dueMonthFor(statementMonth, statementDay, dueDay);
  return {
    statementDate: dayOf(statementMonth, statementDay),
    dueDate: dayOf(dueMonth, dueDay),
  };
}

/** Month of the statement that closes on or after `date`. */
function statementMonthFor(date: IsoDate, statementDay: number): IsoMonth {
  const month = monthOf(date);
  return Number(date.slice(8, 10)) <= clampDay(month, statementDay) ? month : addMonths(month, 1);
}

/** The payment is due in the statement's month when the due day comes later, else the next month. */
function dueMonthFor(statementMonth: IsoMonth, statementDay: number, dueDay: number): IsoMonth {
  return dueDay > statementDay ? statementMonth : addMonths(statementMonth, 1);
}

function dayOf(month: IsoMonth, day: number): IsoDate {
  return `${month}-${String(clampDay(month, day)).padStart(2, '0')}`;
}

/** Formats an ISO date for display without time-zone shifts. */
export function formatDate(
  date: IsoDate,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(toUtcMs(date));
}

function toUtcMs(date: IsoDate): number {
  if (!isIsoDate(date)) throw new RangeError(`Invalid date: ${date}`);
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}
