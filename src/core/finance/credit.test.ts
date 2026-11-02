import { projectLiabilities } from './projections';
import { checkSpendAllowed } from './spend';
import { computeBill, statementPeriodFor, type BillingInput } from './statements';
import { computeCardUsage, type CardUsageInput } from './usage';

// D15: a credit balance (alacak bakiyesi) from overpayments, refunds or a negative override.
const TL = (lira: number) => lira * 100;
const card = { limit: TL(50_000), currency: 'TRY', statementDay: 10, dueDay: 20 };
const today = '2026-11-25';

const charge = (date: string, lira: number) => ({ date, amount: TL(lira), currency: 'TRY' });
const paidStatement = { id: 's1', periodEnd: '2026-11-10', paid: true, installments: [] };
const payment = (date: string, lira: number) => ({
  statementId: 's1',
  date,
  amount: TL(lira),
  currency: 'TRY',
  createdAt: `${date}T12:00:00.000Z`,
});

/** Spend 20.000 in October, then pay 50.000 against the November statement. */
function overpaid(
  extra: Partial<CardUsageInput & BillingInput> = {},
): CardUsageInput & BillingInput {
  return {
    card,
    transactions: [charge('2026-10-15', 20_000)],
    plans: [],
    overrides: [],
    statements: [paidStatement],
    payments: [payment('2026-11-15', 50_000)],
    today,
    ...extra,
  };
}

describe('credit balance (D15)', () => {
  it('limit 50.000, spend 20.000, pay 50.000 → credit 30.000, available 80.000', () => {
    expect(computeCardUsage(overpaid())).toMatchObject({
      used: 0,
      credit: TL(30_000),
      available: TL(80_000),
      utilization: 0,
      level: 'healthy',
      overLimit: false,
    });
    expect(computeBill(statementPeriodFor('2026-11-01', card), overpaid())).toMatchObject({
      amountDue: TL(20_000),
      remaining: 0,
      creditAfter: TL(30_000),
    });
  });

  it('next month a 10.000 spend is covered by the credit: bill 0, credit 20.000', () => {
    const input = overpaid({
      transactions: [charge('2026-10-15', 20_000), charge('2026-11-20', 10_000)],
    });
    expect(computeCardUsage(input)).toMatchObject({ used: 0, credit: TL(20_000) });
    expect(computeBill(statementPeriodFor('2026-11-20', card), input)).toMatchObject({
      total: TL(10_000),
      creditApplied: TL(10_000),
      amountDue: 0,
      remaining: 0,
      creditAfter: TL(20_000),
    });
  });

  it('D12 allows a charge of exactly 80.000 and blocks 80.000,01', () => {
    expect(checkSpendAllowed(overpaid(), { kind: 'charge', amount: TL(80_000) })).toEqual({
      allowed: true,
    });
    expect(checkSpendAllowed(overpaid(), { kind: 'charge', amount: TL(80_000) + 1 })).toEqual({
      allowed: false,
      available: TL(80_000),
    });
  });

  it('turns refunds above the charges into credit', () => {
    const input = overpaid({
      transactions: [charge('2026-11-01', 100), charge('2026-11-02', -300)],
      statements: [],
      payments: [],
    });
    expect(computeCardUsage(input)).toMatchObject({
      used: 0,
      credit: TL(200),
      available: TL(50_200),
    });
    expect(computeBill(statementPeriodFor('2026-11-01', card), input)).toMatchObject({
      amountDue: 0,
      creditAfter: TL(200),
    });
  });

  it('a negative bank balance override is a credit balance carried into the next bill', () => {
    const input = overpaid({
      transactions: [charge('2026-11-05', 2_000)],
      overrides: [
        {
          balance: TL(-5_000),
          currency: 'TRY',
          asOf: '2026-11-01',
          createdAt: '2026-11-01T09:00Z',
        },
      ],
      statements: [],
      payments: [],
    });
    expect(computeCardUsage(input)).toMatchObject({
      used: 0,
      credit: TL(3_000),
      available: TL(53_000),
    });
    expect(computeBill(statementPeriodFor('2026-11-05', card), input)).toMatchObject({
      total: TL(2_000),
      amountDue: 0,
      creditAfter: TL(3_000),
    });
  });

  it('projections apply credit to the upcoming months in order', () => {
    // Spend 1.000, pay 4.000 → 3.000 credit; a 6.000 plan bills 2.000 a month Dec–Feb.
    const plan = {
      id: 'p',
      totalAmount: TL(6_000),
      count: 3,
      purchaseDate: '2026-11-05',
      firstDueMonth: '2026-12',
      currency: 'TRY',
    };
    const input = overpaid({
      transactions: [charge('2026-10-15', 1_000)],
      plans: [plan],
      payments: [payment('2026-11-15', 4_000)],
    });
    expect(projectLiabilities(input, '2026-11', 4)).toEqual([
      { month: '2026-11', amount: 0 },
      { month: '2026-12', amount: 0 },
      { month: '2027-01', amount: TL(1_000) },
      { month: '2027-02', amount: TL(2_000) },
    ]);
  });

  it('keeps the limit and blocks nothing extra when the balance is exactly zero', () => {
    const input = overpaid({ payments: [payment('2026-11-15', 20_000)] });
    expect(computeCardUsage(input)).toMatchObject({ used: 0, credit: 0, available: TL(50_000) });
  });
});
