import { monthlySpend, spendingInMonth } from './spending';

const tx = (date: string, amount: number, currency = 'TRY') => ({ date, amount, currency });

describe('spendingInMonth', () => {
  it('leaves income out: it is not a refund (D17)', () => {
    expect(
      spendingInMonth(
        [
          { date: '2026-10-03', amount: 50_000, currency: 'TRY' },
          { date: '2026-10-01', amount: -4_500_000, currency: 'TRY', income: true },
          { date: '2026-10-05', amount: -10_000, currency: 'TRY' },
        ],
        '2026-10',
        'TRY',
      ),
    ).toBe(40_000);
  });

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

describe('monthlySpend', () => {
  const plan = {
    id: 'p1',
    totalAmount: 120_000,
    count: 3,
    firstDueMonth: '2026-11',
    currency: 'TRY',
  };
  // Credit and debit transactions together: Kipp's spending covers both card types (D13).
  const transactions = [
    tx('2026-11-03', 100_000), // credit single charge
    tx('2026-11-04', 50_000), // debit card purchase
    tx('2026-11-05', -20_000), // refund
    { ...tx('2026-10-15', 120_000), installmentPlanId: 'p1' }, // installment purchase
    { ...tx('2026-11-15', 60_000), installmentPlanId: 'p2' },
  ];

  it('counts installments due in the month as fixed and single charges as variable', () => {
    expect(monthlySpend(transactions, [plan], '2026-11', 'TRY')).toEqual({
      fixed: 40_000,
      variable: 130_000,
    });
  });

  it('keeps billing installments as fixed after the purchase month', () => {
    expect(monthlySpend(transactions, [plan], '2027-01', 'TRY')).toEqual({
      fixed: 40_000,
      variable: 0,
    });
    expect(monthlySpend(transactions, [plan], '2027-02', 'TRY').fixed).toBe(0);
  });

  it('ignores other currencies', () => {
    expect(monthlySpend(transactions, [plan], '2026-11', 'USD')).toEqual({ fixed: 0, variable: 0 });
  });
});
