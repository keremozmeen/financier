import type { CurrencyCode, IsoMonth, Transaction } from '../../types/domain';
import { monthOf } from './dates';
import { installmentSchedule, type ScheduledPlan } from './statements';

/**
 * Spending on a card in a calendar month: charges minus refunds dated in that month,
 * in the card's currency, never below zero. Income from an account statement is not
 * a refund and is left out (D17). Used for debit cards (D13), which have no limit to
 * measure against.
 */
export function spendingInMonth(
  transactions: readonly (Pick<Transaction, 'date' | 'amount' | 'currency'> &
    Partial<Pick<Transaction, 'income'>>)[],
  month: IsoMonth,
  currency: CurrencyCode,
): number {
  const net = transactions
    .filter((tx) => !tx.income && tx.currency === currency && monthOf(tx.date) === month)
    .reduce((sum, tx) => sum + tx.amount, 0);
  return Math.max(net, 0);
}

export interface MonthlySpend {
  /** Installments due in the month (credit cards). */
  fixed: number;
  /** Single charges minus refunds dated in the month, on credit and debit cards, never below zero. */
  variable: number;
}

/**
 * Fixed vs. variable spend for a month in one currency, across cards of both types.
 * Installment purchase transactions are left out: their plan's installments are the
 * fixed part, spread over the months they are due in.
 */
export function monthlySpend(
  transactions: readonly (Pick<Transaction, 'date' | 'amount' | 'currency' | 'installmentPlanId'> &
    Partial<Pick<Transaction, 'income'>>)[],
  plans: readonly ScheduledPlan[],
  month: IsoMonth,
  currency: CurrencyCode,
): MonthlySpend {
  const fixed = plans
    .filter((plan) => plan.currency === currency)
    .flatMap(installmentSchedule)
    .filter((item) => item.dueMonth === month)
    .reduce((sum, item) => sum + item.amount, 0);
  const variable = spendingInMonth(
    transactions.filter((tx) => !tx.installmentPlanId),
    month,
    currency,
  );
  return { fixed, variable };
}
