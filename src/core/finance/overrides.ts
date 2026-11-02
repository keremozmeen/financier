import type { BalanceOverride } from '../../types/domain';

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
