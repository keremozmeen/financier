import {
  cardBills,
  computeBill,
  dueSoon,
  installmentSchedule,
  isFullyPaid,
  paidInstallments,
  statementPeriodDueIn,
  statementPeriodFor,
  upcomingBill,
  upcomingBills,
  type BillingInput,
} from './statements';
import type { Card } from '../../types/domain';

const TL = (lira: number) => lira * 100;
const card = { statementDay: 10, dueDay: 20, currency: 'TRY' };

const charge = (date: string, lira: number, extra: { installmentPlanId?: string } = {}) => ({
  date,
  amount: TL(lira),
  currency: 'TRY',
  ...extra,
});
const plan = (id: string, lira: number, count: number, firstDueMonth: string) => ({
  id,
  totalAmount: TL(lira),
  count,
  firstDueMonth,
  currency: 'TRY',
});

/** A 1.000 ₺ charge, a 200 ₺ refund and a 1.200 ₺ purchase in 3 installments due from November. */
function billing(partial: Partial<BillingInput> = {}): BillingInput {
  return {
    card,
    transactions: [
      charge('2026-10-15', 1_000),
      charge('2026-10-15', 1_200, { installmentPlanId: 'p1' }),
      charge('2026-11-05', -200),
      charge('2026-11-11', 500),
    ],
    plans: [plan('p1', 1_200, 3, '2026-11')],
    statements: [],
    payments: [],
    ...partial,
  };
}

describe('statementPeriodFor', () => {
  it('runs from the day after the previous statement day to this statement day', () => {
    expect(statementPeriodFor('2026-11-02', card)).toEqual({
      periodStart: '2026-10-11',
      periodEnd: '2026-11-10',
      dueDate: '2026-11-20',
      scheduledDueDate: '2026-11-20',
      dueMoved: false,
      dueMonth: '2026-11',
    });
  });

  it('puts the statement day itself in the closing period', () => {
    expect(statementPeriodFor('2026-11-10', card).periodEnd).toBe('2026-11-10');
    expect(statementPeriodFor('2026-11-11', card).periodStart).toBe('2026-11-11');
  });

  it('crosses the year end', () => {
    expect(statementPeriodFor('2026-12-25', card)).toMatchObject({
      periodStart: '2026-12-11',
      periodEnd: '2027-01-10',
      dueDate: '2027-01-20',
    });
  });

  it('clamps a 31st statement day to month ends, February included', () => {
    const days = { statementDay: 31, dueDay: 10 };
    expect(statementPeriodFor('2026-02-15', days)).toMatchObject({
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      scheduledDueDate: '2026-03-10',
    });
    expect(statementPeriodFor('2026-03-01', days)).toMatchObject({
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
    });
    expect(statementPeriodFor('2026-04-30', days)).toMatchObject({
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    });
  });

  it('keeps periods contiguous around February with a 30th statement day', () => {
    const days = { statementDay: 30, dueDay: 10 };
    expect(statementPeriodFor('2026-02-28', days)).toMatchObject({
      periodStart: '2026-01-31',
      periodEnd: '2026-02-28',
    });
    expect(statementPeriodFor('2026-03-05', days)).toMatchObject({
      periodStart: '2026-03-01',
      periodEnd: '2026-03-30',
    });
    expect(statementPeriodFor('2026-03-31', days).periodStart).toBe('2026-03-31');
  });

  it('handles February 29 in a leap year', () => {
    const days = { statementDay: 29, dueDay: 9 };
    expect(statementPeriodFor('2028-02-29', days)).toMatchObject({
      periodStart: '2028-01-30',
      periodEnd: '2028-02-29',
    });
    expect(statementPeriodFor('2028-03-01', days).periodStart).toBe('2028-03-01');
  });

  it('moves a Saturday due date to Monday', () => {
    expect(statementPeriodFor('2026-11-20', { statementDay: 25, dueDay: 5 })).toMatchObject({
      scheduledDueDate: '2026-12-05',
      dueDate: '2026-12-07',
      dueMoved: true,
      dueMonth: '2026-12',
    });
  });

  it('moves a Sunday due date to Monday', () => {
    expect(statementPeriodFor('2026-11-11', card)).toMatchObject({
      scheduledDueDate: '2026-12-20',
      dueDate: '2026-12-21',
      dueMoved: true,
    });
  });
});

describe('statementPeriodDueIn', () => {
  it('finds the statement due in a month, whichever side of the statement day the due day is', () => {
    expect(statementPeriodDueIn('2026-12', card).periodEnd).toBe('2026-12-10');
    expect(statementPeriodDueIn('2026-12', { statementDay: 25, dueDay: 5 }).periodEnd).toBe(
      '2026-11-25',
    );
  });
});

describe('installmentSchedule', () => {
  it('lists each installment with its due month, remainder on the first', () => {
    expect(installmentSchedule({ ...plan('p', 0, 3, '2026-11'), totalAmount: 1000 })).toEqual([
      { planId: 'p', index: 0, amount: 334, dueMonth: '2026-11' },
      { planId: 'p', index: 1, amount: 333, dueMonth: '2026-12' },
      { planId: 'p', index: 2, amount: 333, dueMonth: '2027-01' },
    ]);
  });
});

describe('computeBill', () => {
  const period = statementPeriodFor('2026-11-02', card);

  it('adds single charges and refunds in the period and the installments due in it', () => {
    expect(computeBill(period, billing())).toMatchObject({
      singles: TL(800),
      installments: [{ planId: 'p1', index: 0, amount: TL(400) }],
      total: TL(1_200),
      paidAmount: 0,
      remaining: TL(1_200),
      statementId: undefined,
    });
  });

  it('subtracts the payments recorded for its stored statement', () => {
    const bill = computeBill(
      period,
      billing({
        statements: [{ id: 's1', periodEnd: '2026-11-10', paid: false, installments: [] }],
        payments: [
          {
            statementId: 's1',
            date: '2026-11-15',
            amount: TL(300),
            currency: 'TRY',
            createdAt: 'a',
          },
          {
            statementId: 'other',
            date: '2026-11-15',
            amount: TL(50),
            currency: 'TRY',
            createdAt: 'b',
          },
        ],
      }),
    );
    expect(bill).toMatchObject({ statementId: 's1', paidAmount: TL(300), remaining: TL(900) });
  });

  it('turns refunds above the charges into credit instead of a negative amount due (D15)', () => {
    const bill = computeBill(
      period,
      billing({ transactions: [charge('2026-11-01', -500)], plans: [] }),
    );
    expect(bill).toMatchObject({
      total: TL(-500),
      amountDue: 0,
      remaining: 0,
      creditAfter: TL(500),
    });
  });

  it('ignores other currencies', () => {
    const bill = computeBill(
      period,
      billing({
        transactions: [{ ...charge('2026-11-01', 100), currency: 'USD' }],
        plans: [{ ...plan('u', 300, 3, '2026-11'), currency: 'USD' }],
      }),
    );
    expect(bill.total).toBe(0);
  });
});

describe('upcomingBill', () => {
  it('is the closed statement while it is due and unpaid', () => {
    expect(upcomingBill(billing(), '2026-11-12')).toMatchObject({
      periodEnd: '2026-11-10',
      remaining: TL(1_200),
    });
  });

  it('moves on to the open statement once the closed one is fully paid', () => {
    const input = billing({
      statements: [{ id: 's1', periodEnd: '2026-11-10', paid: true, installments: [] }],
      payments: [
        {
          statementId: 's1',
          date: '2026-11-12',
          amount: TL(1_200),
          currency: 'TRY',
          createdAt: 'a',
        },
      ],
    });
    expect(upcomingBill(input, '2026-11-12')).toMatchObject({
      periodEnd: '2026-12-10',
      dueDate: '2026-12-21',
      singles: TL(500),
      total: TL(900),
    });
  });

  it('does not skip a closed statement that is past due and unpaid', () => {
    expect(upcomingBill(billing(), '2026-11-21')).toMatchObject({
      periodEnd: '2026-11-10',
      remaining: TL(1_200),
    });
  });
});

describe('cardBills: overdue bills (D14)', () => {
  const pay = (statementId: string, periodEnd: string, lira: number, paid: boolean) => ({
    statements: [{ id: statementId, periodEnd, paid, installments: [] }],
    payments: [
      { statementId, date: '2026-11-21', amount: TL(lira), currency: 'TRY', createdAt: 'a' },
    ],
  });

  it('lists an unpaid bill past its due date as overdue, ahead of the open statement', () => {
    expect(cardBills(billing(), '2026-11-21')).toEqual([
      {
        bill: expect.objectContaining({ periodEnd: '2026-11-10', remaining: TL(1_200) }),
        overdue: true,
      },
      { bill: expect.objectContaining({ periodEnd: '2026-12-10' }), overdue: false },
    ]);
  });

  it('is not overdue on its due date', () => {
    expect(cardBills(billing(), '2026-11-20')).toEqual([
      { bill: expect.objectContaining({ periodEnd: '2026-11-10' }), overdue: false },
    ]);
  });

  it('stays overdue after a partial payment, with what is left', () => {
    const items = cardBills(billing(pay('s1', '2026-11-10', 200, false)), '2026-11-25');
    expect(items[0]).toEqual({
      bill: expect.objectContaining({ periodEnd: '2026-11-10', remaining: TL(1_000) }),
      overdue: true,
    });
  });

  it('stops being overdue once fully paid (for example "Paid outside the app")', () => {
    const items = cardBills(billing(pay('s1', '2026-11-10', 1_200, true)), '2026-11-25');
    expect(items).toEqual([
      { bill: expect.objectContaining({ periodEnd: '2026-12-10' }), overdue: false },
    ]);
  });

  it('lists several overdue bills oldest first', () => {
    // The 1.200 ₺ plan bills 400 ₺ in each of November, December and January.
    const items = cardBills(billing(), '2027-01-02');
    expect(items.map(({ bill, overdue }) => [bill.periodEnd, overdue])).toEqual([
      ['2026-11-10', true],
      ['2026-12-10', true],
      ['2027-01-10', false],
    ]);
  });

  it('never flags statements covered by a bank balance override', () => {
    const items = cardBills(
      billing({
        overrides: [{ balance: 0, currency: 'TRY', asOf: '2026-11-20', createdAt: 'x' }],
      }),
      '2026-11-25',
    );
    expect(items.some((item) => item.overdue)).toBe(false);
  });
});

describe('upcomingBills', () => {
  it('lists credit cards only, overdue first, then earliest due', () => {
    const base = { id: 'x', name: '', bank: '', last4: '', color: '', archived: false };
    const cards: Card[] = [
      {
        ...base,
        id: 'late',
        type: 'credit',
        limit: 1,
        currency: 'TRY',
        statementDay: 25,
        dueDay: 5,
      },
      { ...base, id: 'debit', type: 'debit', currency: 'TRY' },
      {
        ...base,
        id: 'early',
        type: 'credit',
        limit: 1,
        currency: 'TRY',
        statementDay: 10,
        dueDay: 20,
      },
    ];
    const bills = upcomingBills(
      cards.map((c) => ({ ...billing(), card: c })),
      '2026-11-12',
    );
    // The 25th/5th card's October statement was due on November 5: overdue comes first.
    expect(bills.map((b) => [b.card.id, b.bill.dueDate, b.overdue])).toEqual([
      ['late', '2026-11-05', true],
      ['early', '2026-11-20', false],
      ['late', '2026-12-07', false],
    ]);
  });
});

describe('isFullyPaid', () => {
  it('needs payments covering a positive total', () => {
    expect(isFullyPaid(TL(100), TL(100))).toBe(true);
    expect(isFullyPaid(TL(100), TL(150))).toBe(true);
    expect(isFullyPaid(TL(100), TL(100) - 1)).toBe(false);
    expect(isFullyPaid(0, 0)).toBe(false);
  });
});

describe('paidInstallments', () => {
  it('lists installments of fully paid statements once', () => {
    const ref = { planId: 'p1', index: 0, amount: 400 };
    expect(
      paidInstallments([
        { id: 'a', periodEnd: '2026-11-10', paid: true, installments: [ref] },
        { id: 'b', periodEnd: '2026-11-10', paid: true, installments: [ref] },
        { id: 'c', periodEnd: '2026-12-10', paid: false, installments: [{ ...ref, index: 1 }] },
      ]),
    ).toEqual([ref]);
  });
});

describe('dueSoon', () => {
  const bill = (dueDate: string, remaining: number, overdue = false) => ({
    bill: { ...computeBill(statementPeriodFor('2026-11-02', card), billing()), dueDate, remaining },
    overdue,
  });

  it('keeps unpaid bills due today through 7 days ahead, earliest first', () => {
    const bills = [
      bill('2026-11-09', TL(10)), // 7 days: included
      bill('2026-11-02', TL(10)), // today: included
      bill('2026-11-10', TL(10)), // 8 days: not yet
      bill('2026-11-01', TL(10)), // past
      bill('2026-11-05', 0), // nothing left to pay
    ];
    expect(dueSoon(bills, '2026-11-02').map((b) => b.bill.dueDate)).toEqual([
      '2026-11-02',
      '2026-11-09',
    ]);
  });

  it('always includes overdue bills, ahead of the others', () => {
    const bills = [bill('2026-11-05', TL(10)), bill('2026-10-20', TL(10), true)];
    expect(dueSoon(bills, '2026-11-02').map((b) => [b.bill.dueDate, b.overdue])).toEqual([
      ['2026-10-20', true],
      ['2026-11-05', false],
    ]);
  });
});
