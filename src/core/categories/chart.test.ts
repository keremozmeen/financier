import { chartSlices, inRingOrder } from './chart';
import type { MainCategoryId } from './categories';

const totals = (rows: [MainCategoryId, number][]) =>
  rows.map(([main, amount]) => ({ main, amount, subs: [] }));

describe('chartSlices', () => {
  it('sorts largest first', () => {
    expect(
      chartSlices(
        totals([
          ['groceries', 10],
          ['transport', 30],
        ]),
      ).map((slice) => slice.key),
    ).toEqual(['transport', 'groceries']);
  });

  it('folds categories without a color into Other', () => {
    expect(
      chartSlices(
        totals([
          ['cash', 10],
          ['fees', 5],
          ['other', 1],
          ['health', 3],
        ]),
      ),
    ).toEqual([
      { key: 'other', amount: 16 },
      { key: 'health', amount: 3 },
    ]);
  });

  it('groups what is past the limit, keeping every kuruş', () => {
    const slices = chartSlices(
      totals([
        ['transport', 50],
        ['groceries', 40],
        ['bills', 30],
        ['health', 20],
        ['travel', 10],
      ]),
      3,
    );
    expect(slices.at(-1)).toEqual({ key: 'rest', amount: 30 });
    expect(slices).toHaveLength(4);
    expect(slices.reduce((sum, slice) => sum + slice.amount, 0)).toBe(150);
  });

  it('shows a single leftover as itself', () => {
    expect(
      chartSlices(
        totals([
          ['transport', 50],
          ['groceries', 40],
          ['bills', 30],
          ['health', 20],
        ]),
        3,
      ).at(-1),
    ).toEqual({ key: 'health', amount: 20 });
  });

  it('is empty with no spending', () => {
    expect(chartSlices([], 3)).toEqual([]);
  });
});

describe('inRingOrder', () => {
  it('draws in the fixed order whatever the amounts, Other and the rest last', () => {
    const slices = [
      { key: 'rest', amount: 90 },
      { key: 'other', amount: 80 },
      { key: 'shopping', amount: 70 },
      { key: 'groceries', amount: 60 },
      { key: 'transport', amount: 1 },
    ] as const;
    expect(inRingOrder(slices).map((slice) => slice.key)).toEqual([
      'transport',
      'groceries',
      'shopping',
      'other',
      'rest',
    ]);
  });
});
