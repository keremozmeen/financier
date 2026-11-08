import { categoryTotals, type TotalsTransaction } from './totals';

const tx = (description: string, amount: number, extra: Partial<TotalsTransaction> = {}) => ({
  description,
  amount,
  date: '2026-11-05',
  currency: 'TRY',
  ...extra,
});
const totals = (rows: TotalsTransaction[], month = '2026-11') =>
  categoryTotals(rows, [], month, 'TRY');

describe('categoryTotals (D22)', () => {
  it('adds up by category, largest first', () => {
    expect(totals([tx('OPET', 100), tx('MIGROS', 300), tx('A101', 200)])).toEqual([
      {
        main: 'groceries',
        amount: 500,
        subs: [{ sub: 'supermarket', amount: 500 }],
      },
      { main: 'transport', amount: 100, subs: [{ sub: 'fuel', amount: 100 }] },
    ]);
  });

  it('never counts income as spending', () => {
    expect(totals([tx('MIGROS', -5_000, { income: true })])).toEqual([]);
    expect(totals([tx('MAAS', -5_000, { income: true }), tx('MIGROS', 100)])[0]!.amount).toBe(100);
  });

  it('lets a refund lower its merchant category', () => {
    expect(totals([tx('MIGROS', 300), tx('MIGROS IADE', -100)])[0]!.amount).toBe(200);
  });

  it('leaves out a category that nets to zero or below', () => {
    expect(totals([tx('MIGROS', 100), tx('MIGROS IADE', -300)])).toEqual([]);
  });

  it('counts only the month and the currency asked for', () => {
    expect(
      totals([
        tx('MIGROS', 100, { date: '2026-10-31' }),
        tx('MIGROS', 100, { currency: 'USD' }),
        tx('MIGROS', 7),
      ])[0]!.amount,
    ).toBe(7);
  });

  it('counts flags and evidence the same way entries are shown', () => {
    const result = categoryTotals(
      [tx('X', 10, { fee: true }), tx('MIGROS', 20), tx('Y', 40, { category: 'travel' })],
      [],
      '2026-11',
      'TRY',
      { rules: new Map([['migros', 'shopping']]) },
    );
    expect(result.map((total) => [total.main, total.amount])).toEqual([
      ['travel', 40],
      ['shopping', 20],
      ['fees', 10],
    ]);
  });

  describe('installments', () => {
    const plan = {
      id: 'p1',
      description: 'TEKNOSA',
      totalAmount: 300,
      count: 3,
      firstDueMonth: '2026-11',
      currency: 'TRY',
    };
    const purchase = tx('TEKNOSA', 300, { installmentPlanId: 'p1', date: '2026-10-20' });

    it('counts what is due in the month, not the whole purchase', () => {
      expect(categoryTotals([purchase], [plan], '2026-11', 'TRY')[0]).toMatchObject({
        main: 'shopping',
        amount: 100,
      });
      expect(categoryTotals([purchase], [plan], '2026-10', 'TRY')).toEqual([]);
      expect(categoryTotals([purchase], [plan], '2027-02', 'TRY')).toEqual([]);
    });

    it('uses the category picked on the purchase', () => {
      const picked = { ...purchase, category: 'education' };
      expect(categoryTotals([picked], [plan], '2026-11', 'TRY')[0]!.main).toBe('education');
    });

    it('falls back to the plan description', () => {
      expect(categoryTotals([], [plan], '2026-11', 'TRY')[0]!.main).toBe('shopping');
    });
  });
});
