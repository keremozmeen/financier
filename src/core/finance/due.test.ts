import { dueUrgency, dueWithin, totalsByCurrency } from './due';
import type { Bill, CardBill } from './statements';

const today = '2026-11-05';
const item = (dueDate: string, remaining: number, extra: Partial<CardBill> = {}) => ({
  card: { currency: 'TRY' },
  bill: { dueDate, remaining } as Bill,
  overdue: false,
  autoPay: false,
  ...extra,
});

describe('dueUrgency (D20)', () => {
  it('is red only when overdue', () => {
    expect(dueUrgency(item('2026-10-20', 100, { overdue: true }), today)).toBe('overdue');
  });

  it('is amber from 2 days before the due date through the due date', () => {
    expect(dueUrgency(item('2026-11-05', 100), today)).toBe('soon');
    expect(dueUrgency(item('2026-11-07', 100), today)).toBe('soon');
    expect(dueUrgency(item('2026-11-08', 100), today)).toBe('later');
  });

  it('stays plain for a card the bank pays automatically', () => {
    expect(dueUrgency(item('2026-11-05', 100, { autoPay: true }), today)).toBe('auto');
  });
});

describe('dueWithin', () => {
  it('keeps overdue bills and those due in the next 30 days with something to pay', () => {
    const bills = [
      item('2026-10-20', 100, { overdue: true }),
      item('2026-11-05', 200),
      item('2026-12-05', 300),
      item('2026-12-06', 400),
      item('2026-11-20', 0),
    ];
    expect(dueWithin(bills, today).map(({ bill }) => bill.remaining)).toEqual([100, 200, 300]);
  });
});

describe('totalsByCurrency', () => {
  it('adds up what is left per currency', () => {
    const usd = { ...item('2026-11-10', 50), card: { currency: 'USD' } };
    expect(totalsByCurrency([item('2026-11-10', 100), usd, item('2026-11-12', 25)])).toEqual([
      { currency: 'TRY', amount: 125 },
      { currency: 'USD', amount: 50 },
    ]);
  });
});
