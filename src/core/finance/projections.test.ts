import type { Card } from '../../types/domain';
import { projectLiabilities, projectTotalLiabilities, totalDebt } from './projections';
import type { BillingInput } from './statements';

const TL = (lira: number) => lira * 100;
const charge = (date: string, lira: number, currency = 'TRY') => ({
  date,
  amount: TL(lira),
  currency,
});
const plan = (
  id: string,
  lira: number,
  count: number,
  firstDueMonth: string,
  currency = 'TRY',
) => ({
  id,
  totalAmount: TL(lira),
  count,
  firstDueMonth,
  currency,
});

const base = { name: '', bank: '', last4: '', color: '', archived: false };
const credit = (id: string, currency = 'TRY'): Card => ({
  ...base,
  id,
  type: 'credit',
  currency,
  limit: TL(100_000),
  statementDay: 10,
  dueDay: 20,
});

/**
 * A 600 ₺ plan due December–February and a 1.000,01 ₺ plan due March–April, so both
 * start and end inside a six-month range, plus single charges in two periods.
 */
const input: BillingInput = {
  card: { statementDay: 10, dueDay: 20, currency: 'TRY' },
  transactions: [charge('2026-11-01', 300), charge('2026-11-20', 50)],
  plans: [plan('a', 600, 3, '2026-12'), { ...plan('b', 0, 2, '2027-03'), totalAmount: 100_001 }],
  statements: [],
  payments: [],
};

describe('projectLiabilities', () => {
  it('projects each due month with installments starting and ending mid-range', () => {
    expect(projectLiabilities(input, '2026-11', 6)).toEqual([
      { month: '2026-11', amount: TL(300) },
      { month: '2026-12', amount: TL(250) },
      { month: '2027-01', amount: TL(200) },
      { month: '2027-02', amount: TL(200) },
      { month: '2027-03', amount: 50_001 },
      { month: '2027-04', amount: 50_000 },
    ]);
  });

  it('supports 3 and 12 months', () => {
    expect(projectLiabilities(input, '2026-11', 3)).toHaveLength(3);
    const year = projectLiabilities(input, '2026-11', 12);
    expect(year.at(-1)).toEqual({ month: '2027-10', amount: 0 });
  });

  it('leaves out what has already been paid', () => {
    const paid = projectLiabilities(
      {
        ...input,
        statements: [{ id: 's', periodEnd: '2026-11-10', paid: false, installments: [] }],
        payments: [
          {
            statementId: 's',
            date: '2026-11-15',
            amount: TL(100),
            currency: 'TRY',
            createdAt: 'x',
          },
        ],
      },
      '2026-11',
      1,
    );
    expect(paid).toEqual([{ month: '2026-11', amount: TL(200) }]);
  });
});

describe('projectTotalLiabilities', () => {
  it('sums credit cards per currency and leaves debit cards out', () => {
    const debit: Card = { ...base, id: 'd', type: 'debit', currency: 'TRY' };
    const rest = { ...input };
    const totals = projectTotalLiabilities(
      [
        { ...rest, card: credit('c1') },
        { ...rest, card: credit('c2') },
        { ...rest, card: debit },
        {
          ...rest,
          card: credit('u', 'USD'),
          transactions: [charge('2026-11-01', 10, 'USD')],
          plans: [],
        },
      ],
      '2026-11',
      3,
    );
    expect(totals).toEqual({
      TRY: [
        { month: '2026-11', amount: TL(600) },
        { month: '2026-12', amount: TL(500) },
        { month: '2027-01', amount: TL(400) },
      ],
      USD: [
        { month: '2026-11', amount: TL(10) },
        { month: '2026-12', amount: 0 },
        { month: '2027-01', amount: 0 },
      ],
    });
  });
});

describe('totalDebt', () => {
  it('sums used per currency over credit cards and leaves debit cards out', () => {
    expect(
      totalDebt([
        { card: { type: 'credit', currency: 'TRY' }, usage: { used: TL(1_000) } },
        { card: { type: 'credit', currency: 'TRY' }, usage: { used: TL(250) } },
        { card: { type: 'credit', currency: 'USD' }, usage: { used: TL(20) } },
        { card: { type: 'debit', currency: 'TRY' } },
      ]),
    ).toEqual({ TRY: TL(1_250), USD: TL(20) });
  });

  it('is empty with only debit cards', () => {
    expect(totalDebt([{ card: { type: 'debit', currency: 'TRY' } }])).toEqual({});
  });
});
