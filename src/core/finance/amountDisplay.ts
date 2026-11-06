import type { CurrencyCode } from '../../types/domain';
import { formatMoney } from './money';

/** Which way one entry moves money, from the user's point of view. */
export type AmountDirection = 'in' | 'out' | 'zero';

export interface DisplayAmount {
  /** The amount without its sign, in minor units. */
  magnitude: number;
  direction: AmountDirection;
}

/**
 * How one stored entry reads on screen. Storage keeps spending positive and money in
 * (refunds, income) negative (D17); that sign drives every total and fingerprint, so it
 * never changes. On screen, spending is shown plain and money in gets a "+": a minus on
 * every purchase would look like an alarm.
 */
export function displayAmount(amount: number): DisplayAmount {
  if (amount === 0) return { magnitude: 0, direction: 'zero' };
  return amount < 0
    ? { magnitude: -amount, direction: 'in' }
    : { magnitude: amount, direction: 'out' };
}

/** "₺1.234,56" for spending, "+₺3.000,00" for money in, "₺0,00" for zero. */
export function formatEntryAmount(amount: number, currency: CurrencyCode, locale: string): string {
  const { magnitude, direction } = displayAmount(amount);
  const text = formatMoney(magnitude, currency, locale);
  return direction === 'in' ? `+${text}` : text;
}
