import type {
  BalanceOverride,
  CreditCard,
  InstallmentPlan,
  IsoDate,
  Transaction,
} from '../../types/domain';
import { addDays, daysBetween } from './dates';
import { currentOverride } from './overrides';
import {
  installmentKey,
  installmentSchedule,
  paidInstallments,
  statementPeriodFor,
  sum,
  type BillingPayment,
  type BillingStatement,
} from './statements';

/** An override older than this many days should be refreshed (D11). */
export const OVERRIDE_STALE_DAYS = 30;

export type UtilizationLevel = 'healthy' | 'warning' | 'alert';

export type UsageSource =
  { kind: 'calculated' } | { kind: 'override'; asOf: IsoDate; stale: boolean };

export interface CardUsage {
  /** Debt on the card, never below zero. */
  used: number;
  /** Credit balance from overpayments or refunds, never below zero (D15). */
  credit: number;
  /** limit − used + credit; never negative: 0 when the card is full. */
  available: number;
  /** Used exceeds the limit: the data is out of date and the card is shown as full (D12). */
  overLimit: boolean;
  /** used / limit capped at 1 (a card over its limit is full, D12); null when the limit is 0. */
  utilization: number | null;
  level: UtilizationLevel;
  source: UsageSource;
}

export interface CardUsageInput {
  /** With the statement and due days, older statements count as paid (D11). */
  card: Pick<CreditCard, 'limit' | 'currency'> &
    Partial<Pick<CreditCard, 'statementDay' | 'dueDay'>>;
  transactions: readonly UsageTransaction[];
  plans: readonly UsagePlan[];
  overrides: readonly Pick<BalanceOverride, 'balance' | 'currency' | 'asOf' | 'createdAt'>[];
  /** Stored statements; a fully paid one marks its installments as paid (D14). */
  statements?: readonly BillingStatement[];
  payments?: readonly BillingPayment[];
  today: IsoDate;
}

export type UsageTransaction = Pick<
  Transaction,
  'date' | 'amount' | 'currency' | 'installmentPlanId'
> & { id?: string };

export type UsagePlan = Pick<
  InstallmentPlan,
  'purchaseDate' | 'totalAmount' | 'count' | 'currency'
> &
  Partial<Pick<InstallmentPlan, 'firstDueMonth'>> & { id?: string };

/**
 * Statements closed before the latest closed one count as paid (D11): the bank carried
 * anything unpaid into a newer statement, and an imported history has no payments in
 * the app. Returns the last day they cover and the due month of the last of them.
 */
export function settledThrough(
  card: Pick<CreditCard, 'statementDay' | 'dueDay'>,
  today: IsoDate,
): { date: IsoDate; dueMonth: string } {
  const open = statementPeriodFor(today, card);
  const latestClosed = statementPeriodFor(addDays(open.periodStart, -1), card);
  const settled = statementPeriodFor(addDays(latestClosed.periodStart, -1), card);
  return { date: settled.periodEnd, dueMonth: settled.dueMonth };
}

/** Card limit usage per D11, including installment blocking and the balance override. */
export function computeCardUsage(input: CardUsageInput): CardUsage {
  const { card, today } = input;
  const inCurrency = <T extends { currency: string }>(items: readonly T[]) =>
    items.filter((item) => item.currency === card.currency);

  const override = currentOverride(inCurrency(input.overrides));
  const cycle =
    card.statementDay && card.dueDay
      ? settledThrough({ statementDay: card.statementDay, dueDay: card.dueDay }, today)
      : undefined;
  // A newer cut-off than the override replaces it: the override's balance was billed in
  // statements that now count as paid.
  const settled = cycle && (!override || override.asOf < cycle.date) ? cycle : undefined;
  const cutoff = settled?.date ?? override?.asOf;
  const after = (date: IsoDate) => !cutoff || date > cutoff;

  const singles = inCurrency(input.transactions)
    .filter((tx) => !tx.installmentPlanId && after(tx.date))
    .reduce((sum, tx) => sum + tx.amount, 0);

  // Remaining unpaid balance of the plans: installments in fully paid statements no
  // longer block the limit (D11, D14). Under the settled cut-off, every plan counts and
  // its installments billed in settled statements are paid; under an override, plans
  // bought before its date are in its balance.
  const statements = input.statements ?? [];
  const counted = inCurrency(input.plans).filter(
    (plan) => settled !== undefined || after(plan.purchaseDate),
  );
  const countedIds = new Set(counted.map((plan) => plan.id));
  const isCounted = (ref: { planId: string }) => countedIds.has(ref.planId);
  const released = new Map(
    paidInstallments(statements).map((ref) => [installmentKey(ref), ref.amount]),
  );
  if (settled) {
    for (const plan of counted) {
      if (!plan.id || !plan.firstDueMonth) continue;
      for (const item of installmentSchedule({
        ...plan,
        id: plan.id,
        firstDueMonth: plan.firstDueMonth,
      })) {
        if (item.dueMonth <= settled.dueMonth) released.set(installmentKey(item), item.amount);
      }
    }
  }
  const releasedAmount = (plan: UsagePlan) =>
    [...released.entries()]
      .filter(([key]) => plan.id !== undefined && key.startsWith(`${plan.id}:`))
      .reduce((total, [, amount]) => total + amount, 0);
  const plans = counted.reduce((total, plan) => total + plan.totalAmount - releasedAmount(plan), 0);

  // A payment after the cut-off reduces used by its amount (D14), unless it paid a
  // settled statement. The part of a settling payment that paid installments of counted
  // plans was released above, so it is not subtracted twice.
  const settledIds = new Set(
    statements.filter((s) => settled && s.periodEnd <= settled.date).map((s) => s.id),
  );
  const payments = inCurrency(input.payments ?? []).filter((p) => !settledIds.has(p.statementId));
  let paid = sum(payments.filter((p) => after(p.date)));
  for (const statement of statements) {
    if (settledIds.has(statement.id)) continue;
    const settling = latestPayment(payments.filter((p) => p.statementId === statement.id));
    if (statement.paid && settling && after(settling.date)) {
      paid -= sum(statement.installments.filter(isCounted));
    }
  }

  // The signed balance: below zero the bank owes the user a credit balance, which adds
  // to the spending power without changing the limit (D15).
  const base = settled ? 0 : (override?.balance ?? 0);
  const balance = base + singles + plans - paid;
  const used = Math.max(balance, 0);
  const overLimit = balance > card.limit;

  return {
    used,
    credit: Math.max(-balance, 0),
    available: overLimit ? 0 : card.limit - balance,
    overLimit,
    utilization: card.limit > 0 ? Math.min(used / card.limit, 1) : null,
    level: utilizationLevel(used, card.limit),
    source:
      override && !settled
        ? {
            kind: 'override',
            asOf: override.asOf,
            stale: daysBetween(override.asOf, today) > OVERRIDE_STALE_DAYS,
          }
        : { kind: 'calculated' },
  };
}

function latestPayment<T extends BillingPayment>(payments: readonly T[]): T | undefined {
  return payments.reduce<T | undefined>(
    (latest, p) =>
      !latest || p.date > latest.date || (p.date === latest.date && p.createdAt > latest.createdAt)
        ? p
        : latest,
    undefined,
  );
}

/** Below 30% healthy, 30–70% warning, above 70% (including a full card) alert (D4, D11, D12). */
export function utilizationLevel(used: number, limit: number): UtilizationLevel {
  if (used > limit) return 'alert';
  if (limit <= 0) return 'healthy';
  // Integer comparisons avoid floating-point edge cases at exactly 30% and 70%.
  if (used * 100 < limit * 30) return 'healthy';
  if (used * 100 <= limit * 70) return 'warning';
  return 'alert';
}
