import type { IsoDate } from '../../types/domain';
import { addDays, daysBetween } from './dates';
import type { CardBill } from './statements';

/** The dashboard lists what is due within this many days (D20). */
export const DUE_HORIZON_DAYS = 30;
/** A payment turns amber this many days before its due date (D20). */
export const DUE_URGENT_DAYS = 2;

/**
 * How a payment is shown (D20): `overdue` red, `soon` amber (due within 2 days),
 * `later` plain, `auto` plain because the bank pays it (D14).
 */
export type DueUrgency = 'overdue' | 'soon' | 'later' | 'auto';

export function dueUrgency(item: CardBill, today: IsoDate): DueUrgency {
  if (item.overdue) return 'overdue';
  if (item.autoPay) return 'auto';
  return daysBetween(today, item.bill.dueDate) <= DUE_URGENT_DAYS ? 'soon' : 'later';
}

/**
 * The bills the dashboard leads with (D20): overdue ones and those with something
 * left to pay due within the next 30 days, in the order given (overdue first).
 */
export function dueWithin<T extends CardBill>(
  bills: readonly T[],
  today: IsoDate,
  days = DUE_HORIZON_DAYS,
): T[] {
  const until = addDays(today, days);
  return bills.filter(
    (item) =>
      item.bill.remaining > 0 &&
      (item.overdue || (item.bill.dueDate >= today && item.bill.dueDate <= until)),
  );
}

/** The total of `bills` per currency, in first-seen order. */
export function totalsByCurrency<T extends CardBill & { card: { currency: string } }>(
  bills: readonly T[],
): { currency: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const { card, bill } of bills) {
    totals.set(card.currency, (totals.get(card.currency) ?? 0) + bill.remaining);
  }
  return [...totals].map(([currency, amount]) => ({ currency, amount }));
}
