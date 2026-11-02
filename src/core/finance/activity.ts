import type { Transaction } from '../../types/domain';

/** The latest entries across all cards of both types (D13), newest first. */
export function recentActivity<T extends Pick<Transaction, 'date'>>(
  transactions: readonly T[],
  limit = 10,
): T[] {
  return [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}
