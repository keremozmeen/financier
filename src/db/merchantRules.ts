import type { MerchantRule } from '../types/domain';
import { db } from './database';

/** The user's "this merchant is always this category" choices (D22). */
export const merchantRulesRepo = {
  list(): Promise<MerchantRule[]> {
    return db.merchantRules.toArray();
  },

  /** Stores the rule, replacing any earlier one for the merchant. */
  async set(merchantKey: string, category: string): Promise<void> {
    if (!merchantKey) throw new RangeError('A rule needs a merchant');
    await db.merchantRules.put({
      id: merchantKey,
      category,
      createdAt: new Date().toISOString(),
    });
  },

  remove(merchantKey: string): Promise<void> {
    return db.merchantRules.delete(merchantKey);
  },
};
