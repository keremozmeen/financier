import { useLiveQuery } from 'dexie-react-hooks';
import type { CategoryEvidence } from '../core/categories';
import { loadCategoryEvidence, loadMerchantRuleRows } from '../db';
import { useToday } from './useFinance';

const NO_EVIDENCE: Required<CategoryEvidence> = { rules: new Map(), subscriptionKeys: new Set() };

/** The rules and subscriptions categories are worked out from (D22). */
export function useCategoryEvidence(): Required<CategoryEvidence> {
  const today = useToday();
  return useLiveQuery(() => loadCategoryEvidence(today), [today]) ?? NO_EVIDENCE;
}

export function useMerchantRules() {
  return useLiveQuery(loadMerchantRuleRows, []);
}
