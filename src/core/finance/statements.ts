import type {
  BalanceOverride,
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
import { currentOverride } from './overrides';

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

export type BillingStatement = Pick<Statement, 'id' | 'periodEnd' | 'paid' | 'installments'> &
  Partial<Pick<Statement, 'autoPaySkipped'>>;
export type BillingPayment = Pick<
  Payment,
  'statementId' | 'date' | 'amount' | 'currency' | 'createdAt'
>;

export interface BillingInput {
  card: Pick<CreditCard, 'statementDay' | 'dueDay' | 'currency' | 'autoPay' | 'autoPaySince'>;
  transactions: readonly Pick<Transaction, 'date' | 'amount' | 'currency' | 'installmentPlanId'>[];
  plans: readonly ScheduledPlan[];
  /** Statements stored when payments were recorded. */
  statements: readonly BillingStatement[];
  payments: readonly BillingPayment[];
  /** Bank balance overrides (D11). A negative one is a credit balance (D15). */
  overrides?: readonly Pick<BalanceOverride, 'balance' | 'currency' | 'asOf' | 'createdAt'>[];
}

export interface Bill extends StatementPeriod {
  /** Single charges minus refunds in the period. */
  singles: number;
  installments: InstallmentRef[];
  /** singles + installments; negative when refunds exceed charges (D15). */
  total: number;
  /** Credit carried in from earlier statements and used against this one (D15). */
  creditApplied: number;
  /** What the bank asks for: total minus the credit applied, never below zero. */
  amountDue: number;
  /** Payments recorded against this statement. */
  paidAmount: number;
  /** amountDue − paidAmount, never below zero. */
  remaining: number;
  /** Credit left after this statement, carried into the next one (D15). */
  creditAfter: number;
  /** The stored statement, once a payment has been recorded. */
  statementId?: string;
}

/** The statement after `period`. */
export function nextStatementPeriod(
  period: StatementPeriod,
  days: Pick<CreditCard, 'statementDay' | 'dueDay'>,
): StatementPeriod {
  return statementPeriodFor(addDays(period.periodEnd, 1), days);
}

/**
 * The card's statements in order from the first one with data through `until`, with
 * credit carried from each statement into the next (D15): overpayments, refunds above
 * the charges and a negative bank balance override all become credit that reduces the
 * following bills. With an override, the chain starts at the first statement after its
 * as-of date and carries the override's credit; earlier statements are covered by it.
 */
export function billsThrough(input: BillingInput, until: StatementPeriod): Bill[] {
  const start = chainStart(input);
  if (!start || start.period.periodEnd > until.periodEnd) return [settle(until, 0, input)];

  const bills: Bill[] = [];
  let period = start.period;
  let credit = start.credit;
  while (period.periodEnd <= until.periodEnd) {
    const bill = settle(period, credit, input);
    bills.push(bill);
    credit = bill.creditAfter;
    period = nextStatementPeriod(period, input.card);
  }
  return bills;
}

/**
 * A statement computed from the data (D14): single charges and refunds dated in the
 * period, plus the installments due in its month, less the credit carried in (D15) and
 * the payments recorded for it. Only amounts in the card's currency count (D2).
 */
export function computeBill(period: StatementPeriod, input: BillingInput): Bill {
  return billsThrough(input, period).at(-1)!;
}

function chainStart(input: BillingInput): { period: StatementPeriod; credit: number } | null {
  const { currency } = input.card;
  const override = currentOverride(
    (input.overrides ?? []).filter((item) => item.currency === currency),
  );
  if (override) {
    return {
      period: statementPeriodFor(addDays(override.asOf, 1), input.card),
      credit: Math.max(-override.balance, 0),
    };
  }
  const dates = [
    ...input.transactions.filter((tx) => tx.currency === currency).map((tx) => tx.date),
    ...input.payments.filter((p) => p.currency === currency).map((p) => p.date),
  ];
  // A plan's first installment is billed in the statement due in its first due month.
  const planPeriods = input.plans
    .filter((plan) => plan.currency === currency)
    .map((plan) => statementPeriodDueIn(plan.firstDueMonth, input.card).periodStart);
  const first = [...dates, ...planPeriods].sort()[0];
  return first ? { period: statementPeriodFor(first, input.card), credit: 0 } : null;
}

function settle(period: StatementPeriod, creditIn: number, input: BillingInput): Bill {
  const { currency } = input.card;
  const singles = input.transactions
    .filter(
      (tx) =>
        tx.currency === currency &&
        !tx.installmentPlanId &&
        tx.date >= period.periodStart &&
        tx.date <= period.periodEnd,
    )
    .reduce((total, tx) => total + tx.amount, 0);

  const installments = input.plans
    .filter((plan) => plan.currency === currency)
    .flatMap(installmentSchedule)
    .filter((item) => item.dueMonth === period.dueMonth)
    .map(({ planId, index, amount }) => ({ planId, index, amount }));

  const total = singles + sum(installments);
  const creditApplied = Math.min(creditIn, Math.max(total, 0));
  const amountDue = Math.max(total, 0) - creditApplied;
  const stored = input.statements.find((s) => s.periodEnd === period.periodEnd);
  const paidAmount = stored
    ? sum(input.payments.filter((p) => p.statementId === stored.id && p.currency === currency))
    : 0;

  return {
    ...period,
    singles,
    installments,
    total,
    creditApplied,
    amountDue,
    paidAmount,
    remaining: Math.max(amountDue - paidAmount, 0),
    // Unused credit, refunds above the charges and any overpayment carry forward.
    creditAfter:
      creditIn - creditApplied + Math.max(-total, 0) + Math.max(paidAmount - amountDue, 0),
    statementId: stored?.id,
  };
}

export interface CardBill {
  bill: Bill;
  /** Past its due date and not fully paid (D14). */
  overdue: boolean;
  /** The bank pays it on its due date; nothing to ask the user (D14). */
  autoPay: boolean;
}

/**
 * The bills a credit card shows (D14): every overdue bill, oldest first, then the next
 * bill — the last closed statement while it is due and not fully paid, otherwise the
 * statement that is still open. A bill stays overdue until payments cover it (including
 * "Paid outside the app"); statements covered by a bank balance override never are.
 */
export function cardBills(input: BillingInput, today: IsoDate): CardBill[] {
  const chain = billsThrough(input, statementPeriodFor(today, input.card));
  const current = chain.at(-1)!;
  const previous =
    chain.at(-2) ??
    computeBill(statementPeriodFor(addDays(current.periodStart, -1), input.card), input);
  const autoPay = Boolean(input.card.autoPay);
  // Overdue never applies to auto-pay cards: the bank pays on the due date.
  const overdue = autoPay ? [] : chain.filter((bill) => bill.dueDate < today && bill.remaining > 0);
  const next = previous.dueDate >= today && previous.remaining > 0 ? previous : current;
  return [
    ...overdue.map((bill) => ({ bill, overdue: true, autoPay })),
    { bill: next, overdue: false, autoPay },
  ];
}

/**
 * Bills auto-pay has paid by `today` (D14): each closed bill with something left to pay,
 * due between the day auto-pay was turned on and today, unless the user deleted its
 * automatic payment. Each counts as fully paid on its due date.
 */
export function autoPaymentsDue(input: BillingInput, today: IsoDate): Bill[] {
  const { autoPay, autoPaySince } = input.card;
  if (!autoPay || !autoPaySince) return [];
  const skipped = new Set(input.statements.filter((s) => s.autoPaySkipped).map((s) => s.periodEnd));
  return billsThrough(input, statementPeriodFor(today, input.card)).filter(
    (bill) =>
      bill.dueDate >= autoPaySince &&
      bill.dueDate <= today &&
      bill.remaining > 0 &&
      !skipped.has(bill.periodEnd),
  );
}

/** The bill a card asks about first: its oldest overdue bill, else its next bill. */
export function upcomingBill(input: BillingInput, today: IsoDate): Bill {
  return cardBills(input, today)[0]!.bill;
}

/**
 * The bills of every credit card: overdue ones first, then by due date. Debit cards
 * have none (D13).
 */
export function upcomingBills<C extends Card>(
  inputs: readonly (Omit<BillingInput, 'card'> & { card: C })[],
  today: IsoDate,
): ({ card: Extract<C, CreditCard> } & CardBill)[] {
  return inputs
    .flatMap(({ card, ...rest }) =>
      card.type === 'credit'
        ? cardBills({ ...rest, card }, today).map((item) => ({
            card: card as Extract<C, CreditCard>,
            ...item,
          }))
        : [],
    )
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) || a.bill.dueDate.localeCompare(b.bill.dueDate),
    );
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

/**
 * Bills that need attention: overdue ones, and those with something left to pay due
 * today or within `days` days. Overdue first, then earliest due. Auto-pay bills need
 * nothing from the user, so they are left out.
 */
export function dueSoon<T extends CardBill>(
  bills: readonly T[],
  today: IsoDate,
  days = DUE_SOON_DAYS,
): T[] {
  return bills
    .filter(({ bill, overdue, autoPay }) => {
      const left = daysBetween(today, bill.dueDate);
      return !autoPay && (overdue || (bill.remaining > 0 && left >= 0 && left <= days));
    })
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) || a.bill.dueDate.localeCompare(b.bill.dueDate),
    );
}
