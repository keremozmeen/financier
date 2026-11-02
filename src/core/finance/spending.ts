import type { CurrencyCode, IsoMonth, Transaction } from '../../types/domain';
import { monthOf } from './dates';

/**
 * Spending on a card in a calendar month: charges minus refunds dated in that month,
 * in the card's currency, never below zero. Used for debit cards (D13), which have
 * no limit to measure against.
 */
export function spendingInMonth(
  transactions: readonly Pick<Transaction, 'date' | 'amount' | 'currency'>[],
  month: IsoMonth,
  currency: CurrencyCode,
): number {
  const net = transactions
    .filter((tx) => tx.currency === currency && monthOf(tx.date) === month)
    .reduce((sum, tx) => sum + tx.amount, 0);
  return Math.max(net, 0);
}
