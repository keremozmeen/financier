import type {
  BalanceOverride,
  CreditCard,
  InstallmentPlan,
  IsoDate,
  Transaction,
} from '../../types/domain';
import { daysBetween } from './dates';
import { currentOverride } from './overrides';
import { paidInstallments, sum, type BillingPayment, type BillingStatement } from './statements';

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
  card: Pick<CreditCard, 'limit' | 'currency'>;
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
> & { id?: string };

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

  // Remaining unpaid balance of the plans: installments in fully paid statements no
  // longer block the limit (D11, D14).
  const statements = input.statements ?? [];
  const counted = inCurrency(input.plans).filter((plan) => after(plan.purchaseDate));
  const countedIds = new Set(counted.map((plan) => plan.id));
  const isCounted = (ref: { planId: string }) => countedIds.has(ref.planId);
  const plans =
    counted.reduce((total, plan) => total + plan.totalAmount, 0) -
    sum(paidInstallments(statements).filter(isCounted));

  // A payment after the as-of date reduces used by its amount (D14). The part of a
  // settling payment that paid installments of counted plans was released above, so
  // it is not subtracted twice.
  const payments = inCurrency(input.payments ?? []);
  let paid = sum(payments.filter((p) => after(p.date)));
  for (const statement of statements) {
    const settling = latestPayment(payments.filter((p) => p.statementId === statement.id));
    if (statement.paid && settling && after(settling.date)) {
      paid -= sum(statement.installments.filter(isCounted));
    }
  }

  // The signed balance: below zero the bank owes the user a credit balance, which adds
  // to the spending power without changing the limit (D15).
  const balance = (override?.balance ?? 0) + singles + plans - paid;
  const used = Math.max(balance, 0);
  const overLimit = balance > card.limit;

  return {
    used,
    credit: Math.max(-balance, 0),
    available: overLimit ? 0 : card.limit - balance,
    overLimit,
    utilization: card.limit > 0 ? Math.min(used / card.limit, 1) : null,
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
