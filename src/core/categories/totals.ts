import type { CurrencyCode, InstallmentPlan, IsoMonth, Transaction } from '../../types/domain';
import { installmentSchedule, monthOf } from '../finance';
import { categorize, type CategorizableEntry, type CategoryEvidence } from './categorize';
import type { MainCategoryId } from './categories';

export interface SubcategoryTotal {
  /** Undefined for entries with no subcategory. */
  sub?: string;
  amount: number;
}

export interface CategoryTotal {
  main: MainCategoryId;
  amount: number;
  subs: SubcategoryTotal[];
}

export type TotalsTransaction = CategorizableEntry &
  Pick<Transaction, 'date' | 'amount' | 'currency'> &
  Partial<Pick<Transaction, 'installmentPlanId'>>;

export type TotalsPlan = Pick<
  InstallmentPlan,
  'id' | 'description' | 'totalAmount' | 'count' | 'firstDueMonth' | 'currency'
>;

/**
 * A month's spending by category in one currency, largest first (D22). Refunds lower their
 * category; income has none. An installment purchase counts by the installments due in the
 * month, under the purchase's category, as the month's spending does elsewhere (Phase 2).
 * A category that nets to zero or below is left out.
 */
export function categoryTotals(
  transactions: readonly TotalsTransaction[],
  plans: readonly TotalsPlan[],
  month: IsoMonth,
  currency: CurrencyCode,
  evidence: CategoryEvidence = {},
): CategoryTotal[] {
  const totals = new Map<MainCategoryId, Map<string | undefined, number>>();
  const add = (entry: CategorizableEntry, amount: number) => {
    const category = categorize(entry, evidence);
    if (!category) return;
    const subs = totals.get(category.main) ?? new Map<string | undefined, number>();
    subs.set(category.sub, (subs.get(category.sub) ?? 0) + amount);
    totals.set(category.main, subs);
  };

  const purchases = new Map<string, TotalsTransaction>();
  for (const tx of transactions) {
    if (tx.installmentPlanId) purchases.set(tx.installmentPlanId, tx);
    else if (tx.currency === currency && monthOf(tx.date) === month) add(tx, tx.amount);
  }
  for (const plan of plans) {
    if (plan.currency !== currency) continue;
    const due = installmentSchedule(plan)
      .filter((item) => item.dueMonth === month)
      .reduce((sum, item) => sum + item.amount, 0);
    if (due !== 0) add(purchases.get(plan.id) ?? { description: plan.description }, due);
  }

  return [...totals]
    .map(([main, subs]) => ({
      main,
      amount: [...subs.values()].reduce((sum, amount) => sum + amount, 0),
      subs: [...subs]
        .map(([sub, amount]) => ({ sub, amount }))
        .filter((item) => item.amount > 0)
        .sort((a, b) => b.amount - a.amount),
    }))
    .filter((total) => total.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}
