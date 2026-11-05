import { currentOverride } from './overrides';
import { computeCardUsage, utilizationLevel, type CardUsageInput } from './usage';

const TL = (lira: number) => lira * 100;
const card = { limit: TL(50_000), currency: 'TRY' };
const today = '2026-11-02';

function usage(partial: Partial<CardUsageInput>) {
  return computeCardUsage({ card, transactions: [], plans: [], overrides: [], today, ...partial });
}

const charge = (date: string, lira: number, currency = 'TRY') => ({
  date,
  amount: TL(lira),
  currency,
});
const plan = (purchaseDate: string, lira: number, count: number) => ({
  purchaseDate,
  totalAmount: TL(lira),
  count,
  currency: 'TRY',
});
const override = (asOf: string, lira: number, createdAt = `${asOf}T12:00:00.000Z`) => ({
  asOf,
  balance: TL(lira),
  currency: 'TRY',
  createdAt,
});

describe('computeCardUsage without an override', () => {
  it('is all limit available for an empty card', () => {
    expect(usage({})).toEqual({
      used: 0,
      credit: 0,
      available: TL(50_000),
      overLimit: false,
      utilization: 0,
      level: 'healthy',
      source: { kind: 'calculated' },
    });
  });

  it('blocks the full value of an installment purchase on day one (D11 example)', () => {
    const result = usage({ plans: [plan('2026-11-01', 12_000, 6)] });
    expect(result.used).toBe(TL(12_000));
    expect(result.available).toBe(TL(38_000));
  });

  it('adds single charges and installment plans', () => {
    const result = usage({
      transactions: [charge('2026-10-20', 1_500), charge('2026-10-25', 500)],
      plans: [plan('2026-10-01', 12_000, 6)],
    });
    expect(result.used).toBe(TL(14_000));
  });

  it('does not count the purchase transaction of a plan twice', () => {
    const result = usage({
      transactions: [{ ...charge('2026-11-01', 12_000), installmentPlanId: 'p1' }],
      plans: [plan('2026-11-01', 12_000, 6)],
    });
    expect(result.used).toBe(TL(12_000));
  });

  it('lowers used for refunds but never below zero', () => {
    expect(
      usage({ transactions: [charge('2026-10-01', 1_000), charge('2026-10-02', -400)] }).used,
    ).toBe(TL(600));
    expect(usage({ transactions: [charge('2026-10-02', -400)] }).used).toBe(0);
  });

  it('ignores amounts in other currencies', () => {
    const result = usage({
      transactions: [charge('2026-10-01', 1_000), charge('2026-10-01', 50, 'USD')],
    });
    expect(result.used).toBe(TL(1_000));
  });
});

describe('computeCardUsage over the limit (D12)', () => {
  it('treats the card as full: 100% utilization, available 0, alert', () => {
    const result = usage({ transactions: [charge('2026-10-01', 52_000)] });
    expect(result).toMatchObject({
      used: TL(52_000),
      available: 0,
      overLimit: true,
      utilization: 1,
      level: 'alert',
    });
  });

  it('is exactly at the limit without being over it', () => {
    const result = usage({ transactions: [charge('2026-10-01', 50_000)] });
    expect(result).toMatchObject({ available: 0, overLimit: false, level: 'alert' });
  });
});

describe('computeCardUsage with a balance override', () => {
  const transactions = [
    charge('2026-10-10', 1_000), // before as-of: included in override
    charge('2026-10-20', 2_000), // on as-of day: included in override
    charge('2026-10-21', 300), // after: added
  ];
  const plans = [
    plan('2026-10-01', 6_000, 3), // before: included in override
    plan('2026-10-25', 9_000, 9), // after: full remaining value added
  ];

  it('uses override + later single charges + later installment plans', () => {
    const result = usage({ transactions, plans, overrides: [override('2026-10-20', 7_500)] });
    expect(result.used).toBe(TL(7_500 + 300 + 9_000));
    expect(result.source).toEqual({ kind: 'override', asOf: '2026-10-20', stale: false });
  });

  it('uses the most recently entered override and keeps the rest as history', () => {
    const result = usage({
      transactions,
      plans,
      overrides: [
        override('2026-10-20', 7_500, '2026-10-20T09:00:00.000Z'),
        override('2026-11-01', 0, '2026-11-01T09:00:00.000Z'), // bill paid
      ],
    });
    expect(result.used).toBe(0);
    expect(result.source).toMatchObject({ asOf: '2026-11-01' });
  });

  it('marks an override older than 30 days as stale', () => {
    expect(usage({ overrides: [override('2026-10-03', 100)] }).source).toMatchObject({
      stale: false,
    });
    expect(usage({ overrides: [override('2026-10-02', 100)] }).source).toMatchObject({
      stale: true,
    });
  });

  it('can put the card over its limit', () => {
    const result = usage({
      overrides: [override('2026-11-01', 49_000)],
      transactions: [charge('2026-11-02', 2_000)],
    });
    expect(result).toMatchObject({ used: TL(51_000), available: 0, overLimit: true });
  });
});

describe('currentOverride', () => {
  it('picks the latest createdAt', () => {
    const a = override('2026-11-01', 1, '2026-11-01T08:00:00.000Z');
    const b = override('2026-10-01', 2, '2026-11-01T09:00:00.000Z');
    expect(currentOverride([a, b])).toBe(b);
    expect(currentOverride([])).toBeUndefined();
  });
});

describe('utilizationLevel', () => {
  it.each([
    [0, 'healthy'],
    [29_99, 'healthy'],
    [30_00, 'warning'],
    [70_00, 'warning'],
    [70_01, 'alert'],
    [100_00, 'alert'],
    [100_01, 'alert'],
  ] as const)('%i of 10000 → %s', (used, level) => {
    expect(utilizationLevel(used, 10_000)).toBe(level);
  });

  it('handles a zero limit', () => {
    expect(utilizationLevel(0, 0)).toBe('healthy');
    expect(utilizationLevel(1, 0)).toBe('alert');
  });
});

describe('computeCardUsage with bill payments (D14)', () => {
  // A 1.000 ₺ charge and a 1.200 ₺ plan in 3 installments; the November statement
  // bills the charge and the first 400 ₺ installment: 1.400 ₺.
  const base = {
    transactions: [charge('2026-10-15', 1_000)],
    plans: [{ ...plan('2026-10-15', 1_200, 3), id: 'p1' }],
  };
  const statement = (paid: boolean) => ({
    id: 's1',
    periodEnd: '2026-11-10',
    paid,
    installments: [{ planId: 'p1', index: 0, amount: TL(400) }],
  });
  const payment = (date: string, lira: number, createdAt = `${date}T12:00:00.000Z`) => ({
    statementId: 's1',
    date,
    amount: TL(lira),
    currency: 'TRY',
    createdAt,
  });

  it('starts from the charge plus the full plan', () => {
    expect(usage(base).used).toBe(TL(2_200));
  });

  it('a full payment reduces used by its amount and releases the paid installment', () => {
    const result = usage({
      ...base,
      statements: [statement(true)],
      payments: [payment('2026-11-15', 1_400)],
    });
    // The 800 ₺ still blocked are the two unpaid installments.
    expect(result.used).toBe(TL(800));
  });

  it('a settled statement paid in two parts releases the installment once', () => {
    const result = usage({
      ...base,
      statements: [statement(true)],
      payments: [payment('2026-11-12', 400), payment('2026-11-15', 1_000)],
    });
    expect(result.used).toBe(TL(800));
  });

  it('a partial payment reduces used by its amount but marks nothing paid', () => {
    const result = usage({
      ...base,
      statements: [statement(false)],
      payments: [payment('2026-11-15', 500)],
    });
    expect(result.used).toBe(TL(1_700));
  });

  it('ignores payments dated on or before the override as-of date', () => {
    const result = usage({
      ...base,
      overrides: [override('2026-11-20', 900)],
      statements: [statement(false)],
      payments: [payment('2026-11-15', 500), payment('2026-11-20', 100)],
    });
    expect(result.used).toBe(TL(900));
  });

  it('subtracts payments dated after the override as-of date', () => {
    const result = usage({
      ...base,
      overrides: [override('2026-11-20', 900)],
      statements: [statement(false)],
      payments: [payment('2026-11-25', 500)],
    });
    expect(result.used).toBe(TL(400));
  });

  it('a full payment after the override reduces used by its full amount when the plan is in the override', () => {
    const result = usage({
      ...base,
      overrides: [override('2026-10-31', 2_200)],
      statements: [statement(true)],
      payments: [payment('2026-11-15', 1_400)],
    });
    expect(result.used).toBe(TL(800));
  });

  it('ignores payments in other currencies', () => {
    const result = usage({
      ...base,
      statements: [statement(false)],
      payments: [{ ...payment('2026-11-15', 500), currency: 'USD' }],
    });
    expect(result.used).toBe(TL(2_200));
  });

  it('never goes below zero after an overpayment', () => {
    const result = usage({
      transactions: [charge('2026-10-15', 100)],
      statements: [{ ...statement(true), installments: [] }],
      payments: [payment('2026-11-15', 500)],
    });
    expect(result.used).toBe(0);
  });
});

describe('computeCardUsage: older statements count as paid (D11)', () => {
  // Statement on the 10th, due on the 20th. On 2026-11-02 the open statement runs from
  // October 11, the latest closed one from September 11 to October 10, and everything
  // through September 10 counts as paid.
  const cycled = { ...card, statementDay: 10, dueDay: 20 };
  const cycleUsage = (partial: Partial<CardUsageInput>) => usage({ card: cycled, ...partial });

  it('ignores a year of imported charges without payments, except the last two statements', () => {
    const months = Array.from({ length: 12 }, (_, i) =>
      charge(new Date(Date.UTC(2025, 10 + i, 1)).toISOString().slice(0, 10), 100),
    );
    // Charged on October 1 (latest closed statement) and on November 1 (open one).
    expect(cycleUsage({ transactions: [...months, charge('2026-11-01', 100)] }).used).toBe(TL(200));
  });

  it('counts the settled date itself as paid and the day after as unpaid', () => {
    expect(cycleUsage({ transactions: [charge('2026-09-10', 70)] }).used).toBe(0);
    expect(cycleUsage({ transactions: [charge('2026-09-11', 70)] }).used).toBe(TL(70));
  });

  it('keeps blocking the installments of an old plan that are not billed yet', () => {
    // 1.200 ₺ in 12 installments from January 2026: January–September are billed in
    // settled statements, October to December still block 300 ₺.
    const old = { ...plan('2025-12-20', 1_200, 12), id: 'p1', firstDueMonth: '2026-01' };
    expect(cycleUsage({ plans: [old] }).used).toBe(TL(300));
  });

  it('does not subtract a payment made for a settled statement', () => {
    const result = cycleUsage({
      transactions: [charge('2026-09-05', 500), charge('2026-10-01', 400)],
      statements: [{ id: 's9', periodEnd: '2026-09-10', paid: true, installments: [] }],
      payments: [
        { statementId: 's9', date: '2026-09-18', amount: TL(500), currency: 'TRY', createdAt: 'a' },
      ],
    });
    expect(result.used).toBe(TL(400));
  });

  it('subtracts a payment made for the latest closed statement', () => {
    const result = cycleUsage({
      transactions: [charge('2026-10-01', 400)],
      statements: [{ id: 's10', periodEnd: '2026-10-10', paid: true, installments: [] }],
      payments: [
        {
          statementId: 's10',
          date: '2026-10-18',
          amount: TL(400),
          currency: 'TRY',
          createdAt: 'a',
        },
      ],
    });
    expect(result.used).toBe(0);
  });

  it('keeps a bank balance override newer than the settled date', () => {
    const result = cycleUsage({
      overrides: [override('2026-10-15', 2_000)],
      transactions: [charge('2026-10-01', 400), charge('2026-10-20', 100)],
    });
    expect(result).toMatchObject({ used: TL(2_100), source: { kind: 'override' } });
  });

  it('replaces an override older than the settled date', () => {
    const result = cycleUsage({
      overrides: [override('2026-08-01', 2_000)],
      transactions: [charge('2026-10-01', 400)],
    });
    expect(result).toMatchObject({ used: TL(400), source: { kind: 'calculated' } });
  });
});
