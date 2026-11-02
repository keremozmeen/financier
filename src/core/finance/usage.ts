import type {
  BalanceOverride,
  Card,
  InstallmentPlan,
  IsoDate,
  Transaction,
} from '../../types/domain';
import { daysBetween } from './dates';
import { remainingPlanBalance } from './installments';

/** An override older than this many days should be refreshed (D11). */
export const OVERRIDE_STALE_DAYS = 30;

export type UtilizationLevel = 'healthy' | 'warning' | 'alert';

export type UsageSource =
  { kind: 'calculated' } | { kind: 'override'; asOf: IsoDate; stale: boolean };

export interface CardUsage {
  used: number;
  /** Never negative: 0 when the card is over its limit. */
  available: number;
  overLimit: boolean;
  /** used / limit, for display only; null when the limit is 0. */
  utilization: number | null;
  level: UtilizationLevel;
  source: UsageSource;
}

export interface CardUsageInput {
  card: Pick<Card, 'limit' | 'currency'>;
  transactions: readonly Pick<Transaction, 'date' | 'amount' | 'currency' | 'installmentPlanId'>[];
  plans: readonly UsagePlan[];
  overrides: readonly Pick<BalanceOverride, 'balance' | 'currency' | 'asOf' | 'createdAt'>[];
  today: IsoDate;
}

export type UsagePlan = Pick<
  InstallmentPlan,
  'purchaseDate' | 'totalAmount' | 'count' | 'currency'
> & {
  /** Installments already paid. Payments are tracked from Phase 2; until then none. */
  paidInstallments?: number;
};

/** The current override is the most recently entered one; older ones are history. */
export function currentOverride<T extends Pick<BalanceOverride, 'createdAt'>>(
  overrides: readonly T[],
): T | undefined {
  let latest: T | undefined;
  for (const override of overrides) {
    if (!latest || override.createdAt > latest.createdAt) latest = override;
  }
  return latest;
}

/** Card limit usage per D11, including installment blocking and the balance override. */
export function computeCardUsage(input: CardUsageInput): CardUsage {
  const { card, today } = input;
  const inCurrency = <T extends { currency: string }>(items: readonly T[]) =>
    items.filter((item) => item.currency === card.currency);

  const override = currentOverride(inCurrency(input.overrides));
  const after = (date: IsoDate) => !override || date > override.asOf;

  const singles = inCurrency(input.transactions)
    .filter((tx) => !tx.installmentPlanId && after(tx.date))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const plans = inCurrency(input.plans)
    .filter((plan) => after(plan.purchaseDate))
    .reduce(
      (sum, plan) =>
        sum + remainingPlanBalance(plan.totalAmount, plan.count, plan.paidInstallments ?? 0),
      0,
    );

  // Refunds can exceed charges; a credit balance still means nothing is used.
  const used = Math.max((override?.balance ?? 0) + singles + plans, 0);
  const overLimit = used > card.limit;

  return {
    used,
    available: overLimit ? 0 : card.limit - used,
    overLimit,
    utilization: card.limit > 0 ? used / card.limit : null,
    level: utilizationLevel(used, card.limit),
    source: override
      ? {
          kind: 'override',
          asOf: override.asOf,
          stale: daysBetween(override.asOf, today) > OVERRIDE_STALE_DAYS,
        }
      : { kind: 'calculated' },
  };
}

/** Below 30% healthy, 30–70% warning, above 70% or over limit alert (D4, D11). */
export function utilizationLevel(used: number, limit: number): UtilizationLevel {
  if (used > limit) return 'alert';
  if (limit <= 0) return 'healthy';
  // Integer comparisons avoid floating-point edge cases at exactly 30% and 70%.
  if (used * 100 < limit * 30) return 'healthy';
  if (used * 100 <= limit * 70) return 'warning';
  return 'alert';
}
