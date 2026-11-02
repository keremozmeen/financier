import type { Card, CurrencyCode, IsoMonth } from '../../types/domain';
import { addMonths } from './dates';
import { computeBill, statementPeriodDueIn, type BillingInput } from './statements';
import type { CardUsage } from './usage';

export interface MonthAmount {
  month: IsoMonth;
  amount: number;
}

/**
 * What a credit card will ask for in each of `months` due months from `fromMonth`:
 * the unpaid remainder of the statement due that month, which holds the installments
 * due then plus any single charges already recorded in its period (D14). Months are
 * the scheduled due months, before the weekend shift.
 */
export function projectLiabilities(
  input: BillingInput,
  fromMonth: IsoMonth,
  months: number,
): MonthAmount[] {
  return Array.from({ length: months }, (_, i) => {
    const month = addMonths(fromMonth, i);
    return { month, amount: computeBill(statementPeriodDueIn(month, input.card), input).remaining };
  });
}

/** Liability projection across all credit cards, per currency (D2). Debit cards owe nothing (D13). */
export function projectTotalLiabilities(
  inputs: readonly (Omit<BillingInput, 'card'> & { card: Card })[],
  fromMonth: IsoMonth,
  months: number,
): Record<CurrencyCode, MonthAmount[]> {
  const totals: Record<CurrencyCode, MonthAmount[]> = {};
  for (const { card, ...rest } of inputs) {
    if (card.type !== 'credit') continue;
    const projection = projectLiabilities({ ...rest, card }, fromMonth, months);
    const running = (totals[card.currency] ??= projection.map(({ month }) => ({
      month,
      amount: 0,
    })));
    projection.forEach(({ amount }, i) => (running[i]!.amount += amount));
  }
  return totals;
}

/** Total debt per currency: what is used on every credit card (D11). Debit cards have no debt. */
export function totalDebt(
  summaries: readonly { card: Pick<Card, 'type' | 'currency'>; usage?: Pick<CardUsage, 'used'> }[],
): Record<CurrencyCode, number> {
  const totals: Record<CurrencyCode, number> = {};
  for (const { card, usage } of summaries) {
    if (card.type !== 'credit' || !usage) continue;
    totals[card.currency] = (totals[card.currency] ?? 0) + usage.used;
  }
  return totals;
}
