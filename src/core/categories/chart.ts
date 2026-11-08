import type { MainCategoryId } from './categories';
import type { CategoryTotal } from './totals';

/**
 * Categories with a chart color of their own. A category keeps its color, and the order
 * alternates warm and cool hues so slices that touch don't blend.
 */
export const CHART_CATEGORIES = [
  'transport',
  'groceries',
  'eating-out',
  'bills',
  'shopping',
  'subscriptions',
  'travel',
  'health',
] as const satisfies readonly MainCategoryId[];

export type ChartSliceKey = (typeof CHART_CATEGORIES)[number] | 'other' | 'rest';

export interface ChartSlice {
  key: ChartSliceKey;
  amount: number;
}

const HAS_COLOR = new Set<MainCategoryId>(CHART_CATEGORIES);

/**
 * A month's totals as chart slices, largest first. Categories without a color fold into
 * Other, so a chart never needs more colors than it can keep apart. With `limit`, the
 * slices past it become one "rest" slice; a single leftover slice is shown as itself.
 */
export function chartSlices(totals: readonly CategoryTotal[], limit?: number): ChartSlice[] {
  const amounts = new Map<ChartSliceKey, number>();
  for (const { main, amount } of totals) {
    const key = HAS_COLOR.has(main) ? (main as ChartSliceKey) : 'other';
    amounts.set(key, (amounts.get(key) ?? 0) + amount);
  }
  const slices = [...amounts]
    .map(([key, amount]) => ({ key, amount }))
    .sort((a, b) => b.amount - a.amount);
  if (limit === undefined || slices.length <= limit + 1) return slices;
  const rest = slices.slice(limit).reduce((sum, slice) => sum + slice.amount, 0);
  return [...slices.slice(0, limit), { key: 'rest', amount: rest }];
}

/** The slices in drawing order: fixed, so neighbouring colors stay far apart. */
export function inRingOrder(slices: readonly ChartSlice[]): ChartSlice[] {
  const rank = ({ key }: ChartSlice) => {
    const index = (CHART_CATEGORIES as readonly string[]).indexOf(key);
    if (index >= 0) return index;
    return key === 'other' ? CHART_CATEGORIES.length : CHART_CATEGORIES.length + 1;
  };
  return [...slices].sort((a, b) => rank(a) - rank(b));
}
