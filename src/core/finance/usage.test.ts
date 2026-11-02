import { computeCardUsage, currentOverride, utilizationLevel, type CardUsageInput } from './usage';

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

  it('releases paid installments (from Phase 2 on)', () => {
    const result = usage({ plans: [{ ...plan('2026-09-01', 12_000, 6), paidInstallments: 2 }] });
    expect(result.used).toBe(TL(8_000));
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

describe('computeCardUsage over the limit', () => {
  it('shows available as 0 and alerts', () => {
    const result = usage({ transactions: [charge('2026-10-01', 52_000)] });
    expect(result).toMatchObject({
      used: TL(52_000),
      available: 0,
      overLimit: true,
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
