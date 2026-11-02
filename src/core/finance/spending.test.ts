import { spendingInMonth } from './spending';

const tx = (date: string, amount: number, currency = 'TRY') => ({ date, amount, currency });

describe('spendingInMonth', () => {
  it('sums charges minus refunds dated in the month', () => {
    expect(
      spendingInMonth(
        [tx('2026-11-01', 85_000), tx('2026-11-02', 85_000), tx('2026-11-03', -10_000)],
        '2026-11',
        'TRY',
      ),
    ).toBe(160_000);
  });

  it('ignores other months and other currencies', () => {
    expect(
      spendingInMonth(
        [tx('2026-10-31', 50_000), tx('2026-12-01', 50_000), tx('2026-11-15', 2_000, 'USD')],
        '2026-11',
        'TRY',
      ),
    ).toBe(0);
  });

  it('never goes below zero when refunds exceed charges', () => {
    expect(spendingInMonth([tx('2026-11-05', -40_000)], '2026-11', 'TRY')).toBe(0);
  });
});
