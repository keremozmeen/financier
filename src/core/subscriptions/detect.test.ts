import { detectSeries, isNotableIncrease, type RadarTransaction } from './detect';

const TODAY = '2026-10-20';
let n = 0;

function tx(
  date: string,
  description: string,
  amount: number,
  patch: Partial<RadarTransaction> = {},
): RadarTransaction {
  return { id: `t${++n}`, cardId: 'c1', date, description, amount, currency: 'TRY', ...patch };
}

/** Monthly charges on the 15th, ending in October. */
const monthly = (description: string, amounts: number[], patch: Partial<RadarTransaction> = {}) =>
  amounts.map((amount, i) => {
    const month = 10 - amounts.length + 1 + i;
    return tx(`2026-${String(month).padStart(2, '0')}-15`, description, amount, patch);
  });

describe('detectSeries (D19)', () => {
  describe('cadence', () => {
    it('finds a monthly subscription after 3 charges', () => {
      const [series] = detectSeries(monthly('NETFLIX.COM', [22_999, 22_999, 22_999]), TODAY);
      expect(series).toMatchObject({
        key: 'netflix|TRY',
        merchant: 'netflix',
        name: 'Netflix',
        bankText: 'NETFLIX.COM',
        kind: 'subscription',
        cadence: 'monthly',
        amount: 22_999,
        monthly: 22_999,
        yearly: 275_988,
        active: true,
        nextDate: '2026-11-15',
      });
      expect(series?.charges).toHaveLength(3);
    });

    it('needs 3 monthly charges', () => {
      expect(detectSeries(monthly('NETFLIX.COM', [22_999, 22_999]), TODAY)).toEqual([]);
    });

    it('finds a weekly subscription and prices it per month and year', () => {
      const rows = ['2026-10-01', '2026-10-08', '2026-10-15'].map((d) => tx(d, 'GYM', 10_000));
      expect(detectSeries(rows, TODAY)[0]).toMatchObject({
        cadence: 'weekly',
        monthly: 43_333,
        yearly: 520_000,
        nextDate: '2026-10-22',
      });
    });

    it('finds a yearly subscription after 2 charges', () => {
      const rows = [tx('2025-03-01', 'ADOBE', 120_000), tx('2026-03-03', 'ADOBE', 120_000)];
      expect(detectSeries(rows, TODAY)[0]).toMatchObject({
        cadence: 'yearly',
        monthly: 10_000,
        yearly: 120_000,
        active: true,
        nextDate: '2027-03-03',
      });
    });

    it('allows a few days of posting delay but not a gap', () => {
      const delayed = ['2026-07-15', '2026-08-11', '2026-09-13', '2026-10-15'];
      expect(
        detectSeries(
          delayed.map((d) => tx(d, 'SPOTIFY', 5_999)),
          TODAY,
        )[0]?.charges,
      ).toHaveLength(4);

      // A 40-day gap breaks the run: only the 2 charges after it are a run, which is too short.
      const gap = ['2026-07-15', '2026-08-24', '2026-09-23'];
      expect(
        detectSeries(
          gap.map((d) => tx(d, 'SPOTIFY', 5_999)),
          TODAY,
        ),
      ).toEqual([]);
    });

    it('clamps the next charge to the end of a short month', () => {
      const rows = ['2026-11-30', '2026-12-31', '2027-01-31'].map((d) => tx(d, 'EXXEN', 9_900));
      expect(detectSeries(rows, '2027-02-01')[0]?.nextDate).toBe('2027-02-28');
    });

    it('is not active once the charges stop', () => {
      const rows = monthly('BLUTV', [9_900, 9_900, 9_900]);
      expect(detectSeries(rows, '2026-12-15')[0]?.active).toBe(false);
    });
  });

  describe('which charges count', () => {
    it('joins variants of a merchant across cards, but not across currencies', () => {
      const rows = [
        tx('2026-08-15', 'NETFLIX.COM', 22_999, { cardId: 'credit' }),
        tx('2026-09-15', 'IYZICO *NETFLIX', 22_999, { cardId: 'debit' }),
        tx('2026-10-15', 'NETFLIX COM ISTANBUL', 22_999, { cardId: 'debit' }),
        ...monthly('NETFLIX.COM', [999, 999, 999], { currency: 'USD' }),
      ];
      expect(
        detectSeries(rows, TODAY)
          .map((s) => s.key)
          .sort(),
      ).toEqual(['netflix|TRY', 'netflix|USD']);
    });

    it('leaves out fees, transfers, income, installment purchases and refunds', () => {
      const patches: Partial<RadarTransaction>[] = [
        { fee: true },
        { transfer: true },
        { income: true, amount: -500_000 },
        { installmentPlanId: 'p1' },
        { amount: -22_999 },
      ];
      for (const patch of patches) {
        expect(detectSeries(monthly('NETFLIX', [22_999, 22_999, 22_999], patch), TODAY)).toEqual(
          [],
        );
      }
    });

    it('splits two subscriptions from one merchant by amount', () => {
      const rows = [
        ...monthly('APPLE.COM/BILL', [3_999, 3_999, 3_999]),
        ...monthly('APPLE.COM/BILL', [6_499, 6_499, 6_499]),
      ];
      expect(
        detectSeries(rows, TODAY)
          .map((s) => s.key)
          .sort(),
      ).toEqual(['apple bill|TRY#3999', 'apple bill|TRY#6499']);
    });

    it('ignores charges that do not repeat', () => {
      const rows = [
        tx('2026-08-02', 'MIGROS', 45_000),
        tx('2026-08-19', 'MIGROS', 12_000),
        tx('2026-10-01', 'MIGROS', 80_000),
      ];
      expect(detectSeries(rows, TODAY)).toEqual([]);
    });
  });

  describe('price increases', () => {
    it.each([
      ['a clear raise as notable', [22_999, 22_999, 23_999], true],
      ['a raise of 50 kuruş as small', [22_999, 22_999, 23_049], false],
    ])('flags %s', (_, amounts, notable) => {
      const [series] = detectSeries(monthly('NETFLIX', amounts), TODAY);
      expect(series?.increase).toMatchObject({ from: 22_999, to: amounts[2], notable });
      expect(series?.amount).toBe(amounts[2]);
    });

    it('stays quiet when an exchange-rate price wobbles below its high', () => {
      const [series] = detectSeries(
        monthly('SPOTIFY', [10_000, 10_500, 10_200, 10_400, 10_300]),
        TODAY,
      );
      expect(series?.increase).toBeUndefined();
    });

    it('keeps an increase visible for 3 charges, then lets it go', () => {
      const visible = detectSeries(monthly('NETFLIX', [20_000, 22_000, 22_000, 22_000]), TODAY);
      expect(visible[0]?.increase).toMatchObject({ from: 20_000, to: 22_000 });
      const old = detectSeries(monthly('NETFLIX', [20_000, 22_000, 22_000, 22_000, 22_000]), TODAY);
      expect(old[0]?.increase).toBeUndefined();
    });

    it('never flags a decrease', () => {
      expect(
        detectSeries(monthly('NETFLIX', [23_999, 23_999, 22_999]), TODAY)[0]?.increase,
      ).toBeUndefined();
    });
  });

  describe('isNotableIncrease', () => {
    it.each([
      [22_999, 23_999, true], // +₺10, +4.3%
      [100_000, 100_500, true], // +₺5 on a ₺1.000 plan: 0.5%, but 5 units
      [9_900, 10_200, true], // +₺3, +3.0%
      [5_799, 5_849, false], // +₺0,50, +0.9%
      [70_000, 70_490, false], // +₺4,90, +0.7%: exchange-rate drift
    ])('%i → %i is notable: %s', (from, to, notable) => {
      expect(isNotableIncrease(from, to, 'TRY')).toBe(notable);
    });
  });

  describe('double charges', () => {
    const rows = () => [
      ...monthly('SPOTIFY', [5_999, 5_999, 5_999]),
      tx('2026-10-16', 'SPOTIFY', 5_999),
    ];

    it('flags the same amount again within 3 days and keeps the cadence', () => {
      const [series] = detectSeries(rows(), TODAY);
      expect(series?.charges).toHaveLength(3);
      expect(series?.doubles).toHaveLength(1);
      expect(series?.doubles[0]?.second.date).toBe('2026-10-16');
    });

    it('clears when a refund of that amount follows', () => {
      const [series] = detectSeries([...rows(), tx('2026-10-25', 'SPOTIFY IADE', -5_999)], TODAY);
      expect(series?.doubles).toEqual([]);
    });
  });

  describe('bills', () => {
    it('lists a varying utility as a bill with its 3-charge average and no increase', () => {
      const [series] = detectSeries(monthly('ENERJİSA ELEKTRİK', [45_000, 62_000, 38_050]), TODAY);
      expect(series).toMatchObject({ kind: 'bill', amount: 48_350, monthly: 48_350 });
      expect(series?.increase).toBeUndefined();
      expect(series?.charges).toHaveLength(3);
    });

    it('reads an entry marked as a bill by the import (D17)', () => {
      const rows = monthly('ACME SU', [10_000, 30_000, 20_000], { bill: true });
      expect(detectSeries(rows, TODAY)[0]?.kind).toBe('bill');
    });
  });
});
