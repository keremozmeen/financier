import type { Transaction } from '../../types/domain';
import { categoryMerchantKey, isProcessorKey, merchantKey, merchantWords } from '../merchant';
import { BRAND_INDEX } from './brands';
import { parseCategory, type CategoryRef } from './categories';
import { KEYWORD_INDEX } from './keywords';
import { findPhrase } from './phrases';

/** Which D22 evidence decided an entry's category. */
export type CategorySource =
  'pick' | 'rule' | 'flag' | 'subscription' | 'brand' | 'keyword' | 'other';

export interface Categorized extends CategoryRef {
  source: CategorySource;
}

export type CategorizableEntry = Pick<Transaction, 'description'> &
  Partial<Pick<Transaction, 'category' | 'fee' | 'bill' | 'transfer' | 'income'>>;

export interface CategoryEvidence {
  /** The user's rules: category path by `categoryMerchantKey`. */
  rules?: ReadonlyMap<string, string>;
  /** `merchantKey`s of the Sub-Radar subscription series (D19), without bills. */
  subscriptionKeys?: ReadonlySet<string>;
}

function isCashWithdrawal(words: readonly string[]): boolean {
  return findPhrase(words, KEYWORD_INDEX)?.main === 'cash';
}

/**
 * An entry's category by the D22 order of evidence; the first that answers wins.
 * Null for income, which has no spending category.
 */
export function categorize(
  entry: CategorizableEntry,
  { rules, subscriptionKeys }: CategoryEvidence = {},
): Categorized | null {
  if (entry.income) return null;

  const pick = parseCategory(entry.category);
  if (pick) return { ...pick, source: 'pick' };

  const rule = parseCategory(rules?.get(categoryMerchantKey(entry.description)));
  if (rule) return { ...rule, source: 'rule' };

  const words = merchantWords(entry.description);
  const brand = findPhrase(words, BRAND_INDEX);
  const keyword = findPhrase(words, KEYWORD_INDEX);

  if (entry.fee) return { main: 'fees', source: 'flag' };
  if (entry.bill) {
    const known = brand?.main === 'bills' ? brand : keyword?.main === 'bills' ? keyword : undefined;
    return { main: 'bills', sub: known?.sub, source: 'flag' };
  }
  if (entry.transfer) {
    return isCashWithdrawal(words)
      ? { main: 'cash', sub: 'atm', source: 'flag' }
      : { main: 'other', source: 'flag' };
  }

  const key = merchantKey(entry.description);
  if (key && !isProcessorKey(key) && subscriptionKeys?.has(key)) {
    const known = brand?.main === 'subscriptions' ? brand.sub : undefined;
    return { main: 'subscriptions', sub: known, source: 'subscription' };
  }
  if (brand) return { ...brand, source: 'brand' };
  if (keyword) return { ...keyword, source: 'keyword' };
  return { main: 'other', source: 'other' };
}
