import { categorize, type Categorized, type CategoryEvidence } from '../categories';
import type { PlannedRow } from './plan';

/**
 * The category a review row will be saved with (D22), or null when the row saves no new
 * entry of its own or has no spending category (income).
 */
export function reviewCategory(
  { row, outcome }: PlannedRow,
  evidence: CategoryEvidence,
): Categorized | null {
  if (outcome.kind !== 'add' && outcome.kind !== 'newPlan') return null;
  const flag = outcome.kind === 'add' && outcome.flag ? { [outcome.flag]: true } : {};
  return categorize({ description: row.description, category: row.category, ...flag }, evidence);
}
