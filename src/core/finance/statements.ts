import type {
  Card,
  CreditCard,
  InstallmentPlan,
  InstallmentRef,
  IsoDate,
  IsoMonth,
  Payment,
  Statement,
  Transaction,
} from '../../types/domain';
import {
  addDays,
  addMonths,
  dayOf,
  daysBetween,
  dueMonthFor,
  shiftWeekend,
  statementMonthFor,
} from './dates';
import { splitInstallments } from './installments';

type CycleDays = Pick<CreditCard, 'statementDay' | 'dueDay'>;

export interface StatementPeriod {
  /** The day after the previous statement day. */
  periodStart: IsoDate;
  /** The statement day, clamped to short months. */
  periodEnd: IsoDate;
  /** The due date shown to the user, moved off weekends (D14). */
  dueDate: IsoDate;
  /** The due date before the weekend shift. */
  scheduledDueDate: IsoDate;
  /** The due date fell on a weekend and was moved to Monday. */
  dueMoved: boolean;
  /** The month this statement is due in; installments due in it are billed here. */
  dueMonth: IsoMonth;
}

/** The statement period that contains `date`, with its due date (D14). */
export function statementPeriodFor(date: IsoDate, days: CycleDays): StatementPeriod {
  const month = statementMonthFor(date, days.statementDay);
  const dueMonth = dueMonthFor(month, days.statementDay, days.dueDay);
  const scheduledDueDate = dayOf(dueMonth, days.dueDay);
  const due = shiftWeekend(scheduledDueDate);
  return {
    periodStart: addDays(dayOf(addMonths(month, -1), days.statementDay), 1),
    periodEnd: dayOf(month, days.statementDay),
    dueDate: due.date,
    scheduledDueDate,
    dueMoved: due.moved,
    dueMonth,
  };
}

/** The statement period that is due in `dueMonth`. */
export function statementPeriodDueIn(dueMonth: IsoMonth, days: CycleDays): StatementPeriod {
  const month = days.dueDay > days.statementDay ? dueMonth : addMonths(dueMonth, -1);
  return statementPeriodFor(dayOf(month, days.statementDay), days);
}

export type ScheduledPlan = Pick<
  InstallmentPlan,
  'id' | 'totalAmount' | 'count' | 'firstDueMonth' | 'currency'
>;

export interface ScheduledInstallment extends InstallmentRef {
  dueMonth: IsoMonth;
}

/** Every installment of a plan with the month it is due in. */
export function installmentSchedule(plan: ScheduledPlan): ScheduledInstallment[] {
  return splitInstallments(plan.totalAmount, plan.count).map((amount, index) => ({
    planId: plan.id,
    index,
    amount,
    dueMonth: addMonths(plan.firstDueMonth, index),
  }));
}

export type BillingStatement = Pick<Statement, 'id' | 'periodEnd' | 'paid' | 'installments'>;
export type BillingPayment = Pick<
  Payment,
  'statementId' | 'date' | 'amount' | 'currency' | 'createdAt'
>;

export interface BillingInput {
  card: Pick<CreditCard, 'statementDay' | 'dueDay' | 'currency'>;
  transactions: readonly Pick<Transaction, 'date' | 'amount' | 'currency' | 'installmentPlanId'>[];
  plans: readonly ScheduledPlan[];
  /** Statements stored when payments were recorded. */
  statements: readonly BillingStatement[];
  payments: readonly BillingPayment[];
}

export interface Bill extends StatementPeriod {
  /** Single charges minus refunds in the period. */
  singles: number;
  installments: InstallmentRef[];
  /** singles + installments, never below zero. */
  total: number;
  /** Payments recorded against this statement. */
  paidAmount: number;
  /** total − paidAmount, never below zero. */
  remaining: number;
  /** The stored statement, once a payment has been recorded. */
  statementId?: string;
}

/**
 * A statement computed from the data (D14): single charges and refunds dated in the
 * period, plus the installments due in its month, minus the payments recorded for it.
 * Only amounts in the card's currency count (D2).
 */
export function computeBill(period: StatementPeriod, input: BillingInput): Bill {
  const { currency } = input.card;
  const singles = input.transactions
    .filter(
      (tx) =>
        tx.currency === currency &&
        !tx.installmentPlanId &&
        tx.date >= period.periodStart &&
        tx.date <= period.periodEnd,
    )
    .reduce((sum, tx) => sum + tx.amount, 0);

  const installments = input.plans
    .filter((plan) => plan.currency === currency)
    .flatMap(installmentSchedule)
    .filter((item) => item.dueMonth === period.dueMonth)
    .map(({ planId, index, amount }) => ({ planId, index, amount }));

  const total = Math.max(singles + sum(installments), 0);
  const stored = input.statements.find((s) => s.periodEnd === period.periodEnd);
  const paidAmount = stored
    ? sum(input.payments.filter((p) => p.statementId === stored.id && p.currency === currency))
    : 0;

  return {
    ...period,
    singles,
    installments,
    total,
    paidAmount,
    remaining: Math.max(total - paidAmount, 0),
    statementId: stored?.id,
  };
}

/**
 * The card's next bill: the last closed statement while it is due and not fully paid,
 * otherwise the statement that is still open.
 */
export function upcomingBill(input: BillingInput, today: IsoDate): Bill {
  const current = computeBill(statementPeriodFor(today, input.card), input);
  const previous = computeBill(
    statementPeriodFor(addDays(current.periodStart, -1), input.card),
    input,
  );
  return previous.dueDate >= today && previous.remaining > 0 ? previous : current;
}

/** The next bill of every credit card, earliest due first. Debit cards have none (D13). */
export function upcomingBills<C extends Card>(
  inputs: readonly (Omit<BillingInput, 'card'> & { card: C })[],
  today: IsoDate,
): { card: Extract<C, CreditCard>; bill: Bill }[] {
  return inputs
    .flatMap(({ card, ...rest }) =>
      card.type === 'credit'
        ? [{ card: card as Extract<C, CreditCard>, bill: upcomingBill({ ...rest, card }, today) }]
        : [],
    )
    .sort((a, b) => a.bill.dueDate.localeCompare(b.bill.dueDate));
}

/** A payment settles the statement when the payments recorded for it cover its total (D14). */
export function isFullyPaid(total: number, paidAmount: number): boolean {
  return total > 0 && paidAmount >= total;
}

/** The installments in fully paid statements, each once. */
export function paidInstallments(statements: readonly BillingStatement[]): InstallmentRef[] {
  const refs = new Map<string, InstallmentRef>();
  for (const statement of statements) {
    if (!statement.paid) continue;
    for (const ref of statement.installments) refs.set(installmentKey(ref), ref);
  }
  return [...refs.values()];
}

export function installmentKey(ref: Pick<InstallmentRef, 'planId' | 'index'>): string {
  return `${ref.planId}:${ref.index}`;
}

export function sum(items: readonly { amount: number }[]): number {
  return items.reduce((total, item) => total + item.amount, 0);
}

/** Bills due within this many days are "due soon" (D5). */
export const DUE_SOON_DAYS = 7;

/** Bills with something left to pay that are due today or within `days` days, earliest first. */
export function dueSoon<T extends { bill: Bill }>(
  bills: readonly T[],
  today: IsoDate,
  days = DUE_SOON_DAYS,
): T[] {
  return bills
    .filter(({ bill }) => {
      const left = daysBetween(today, bill.dueDate);
      return bill.remaining > 0 && left >= 0 && left <= days;
    })
    .sort((a, b) => a.bill.dueDate.localeCompare(b.bill.dueDate));
}
