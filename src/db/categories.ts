import { categoryMerchantKey, merchantLabel } from '../core/merchant';
import { categoryTotals, type CategoryEvidence, type CategoryTotal } from '../core/categories';
import { addMonths, monthOf } from '../core/finance';
import { detectSeries } from '../core/subscriptions';
import type { CurrencyCode, IsoDate, IsoMonth, MerchantRule } from '../types/domain';
import { cardsRepo } from './cards';
import { db } from './database';
import { merchantRulesRepo } from './merchantRules';
import { subscriptionsRepo } from './subscriptions';

async function allTransactions() {
  const cards = await cardsRepo.list({ includeArchived: true });
  return db.transactions
    .where('cardId')
    .anyOf(cards.map((card) => card.id))
    .toArray();
}

/**
 * What categories are worked out from besides the entry itself (D22): the user's rules and
 * the merchants Sub-Radar found as subscriptions. A series the user said is not a
 * subscription does not count.
 */
export async function loadCategoryEvidence(today: IsoDate): Promise<Required<CategoryEvidence>> {
  const [transactions, rules, choices] = await Promise.all([
    allTransactions(),
    merchantRulesRepo.list(),
    subscriptionsRepo.list(),
  ]);
  const ignored = new Set(
    choices.filter((choice) => choice.status === 'ignored').map((choice) => choice.id),
  );
  return {
    rules: new Map(rules.map((rule) => [rule.id, rule.category])),
    subscriptionKeys: new Set(
      detectSeries(transactions, today)
        .filter((series) => series.kind === 'subscription' && !ignored.has(series.key))
        .map((series) => series.merchant),
    ),
  };
}

export interface MerchantRuleRow extends MerchantRule {
  /** The merchant as the user knows it, from an entry it applies to. */
  name: string;
}

/** The rules for Settings, newest first, each named after one of its entries. */
export async function loadMerchantRuleRows(): Promise<MerchantRuleRow[]> {
  const [rules, transactions] = await Promise.all([merchantRulesRepo.list(), allTransactions()]);
  const names = new Map<string, string>();
  for (const { description } of transactions) {
    const key = categoryMerchantKey(description);
    if (key && !names.has(key)) names.set(key, merchantLabel(description));
  }
  return rules
    .map((rule) => ({ ...rule, name: names.get(rule.id) ?? rule.id }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface CurrencySpending {
  currency: CurrencyCode;
  /** The latest month first. */
  months: { month: IsoMonth; totals: CategoryTotal[] }[];
}

const COMPARED_MONTHS = 3;

/**
 * Spending by category on the active cards, credit and debit (D22), for this month and the
 * two before it, per currency (D2: no conversion), TRY first.
 */
export async function loadCategorySpending(today: IsoDate): Promise<CurrencySpending[]> {
  const cards = await cardsRepo.list();
  const ids = cards.map((card) => card.id);
  const [transactions, plans, evidence] = await Promise.all([
    db.transactions.where('cardId').anyOf(ids).toArray(),
    db.installmentPlans.where('cardId').anyOf(ids).toArray(),
    loadCategoryEvidence(today),
  ]);
  const currencies = [...new Set(cards.map((card) => card.currency))].sort((a, b) =>
    a === 'TRY' ? -1 : b === 'TRY' ? 1 : a.localeCompare(b),
  );
  const current = monthOf(today);
  return currencies.map((currency) => ({
    currency,
    months: Array.from({ length: COMPARED_MONTHS }, (_, back) => {
      const month = addMonths(current, -back);
      return { month, totals: categoryTotals(transactions, plans, month, currency, evidence) };
    }),
  }));
}
