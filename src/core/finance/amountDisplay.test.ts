import { displayAmount, formatEntryAmount } from './amountDisplay';
import { spendingInMonth } from './spending';

// Intl inserts non-breaking spaces in some locales; compare with plain spaces.
const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('displayAmount', () => {
  it('reads stored charges (positive) as money out', () => {
    expect(displayAmount(123_456)).toEqual({ magnitude: 123_456, direction: 'out' });
  });

  it('reads stored refunds and income (negative) as money in', () => {
    expect(displayAmount(-300_000)).toEqual({ magnitude: 300_000, direction: 'in' });
    expect(displayAmount(-5)).toEqual({ magnitude: 5, direction: 'in' });
  });

  it('gives zero no direction', () => {
    expect(displayAmount(0)).toEqual({ magnitude: 0, direction: 'zero' });
    expect(displayAmount(-0)).toEqual({ magnitude: 0, direction: 'zero' });
  });
});

describe('formatEntryAmount', () => {
  it('shows a charge with no sign', () => {
    expect(plain(formatEntryAmount(123_456, 'TRY', 'tr'))).toBe('₺1.234,56');
    expect(plain(formatEntryAmount(123_456, 'TRY', 'en'))).toBe('₺1,234.56');
  });

  it('shows income and refunds with a plus', () => {
    // A 3,000 paycheck is stored as -300000 (D17).
    expect(plain(formatEntryAmount(-300_000, 'TRY', 'tr'))).toBe('+₺3.000,00');
    expect(plain(formatEntryAmount(-300_000, 'TRY', 'en'))).toBe('+₺3,000.00');
    expect(plain(formatEntryAmount(-4_999, 'TRY', 'tr'))).toBe('+₺49,99');
  });

  it('shows zero with no sign', () => {
    expect(plain(formatEntryAmount(0, 'TRY', 'tr'))).toBe('₺0,00');
    expect(plain(formatEntryAmount(-0, 'USD', 'en'))).toBe('$0.00');
  });

  it('works for USD and EUR in both languages', () => {
    expect(plain(formatEntryAmount(-1_050, 'USD', 'en'))).toBe('+$10.50');
    expect(plain(formatEntryAmount(1_050, 'USD', 'en'))).toBe('$10.50');
    expect(plain(formatEntryAmount(-1_050, 'USD', 'tr'))).toBe('+$10,50');
    expect(plain(formatEntryAmount(-123_456, 'EUR', 'en'))).toBe('+€1,234.56');
    expect(plain(formatEntryAmount(123_456, 'EUR', 'tr'))).toBe('€1.234,56');
  });

  it('never shows a minus', () => {
    for (const amount of [-1, -100, -999_999_99, 1, 0]) {
      expect(formatEntryAmount(amount, 'TRY', 'tr')).not.toMatch(/[-−]/);
    }
  });

  it('rejects non-integer amounts like formatMoney', () => {
    expect(() => formatEntryAmount(-12.5, 'TRY', 'tr')).toThrow(TypeError);
  });
});

describe('display versus totals', () => {
  it('changes only how entries read, not the stored sign that totals use (D17)', () => {
    const entries = [
      { date: '2026-10-03', amount: 50_000, currency: 'TRY', income: false },
      { date: '2026-10-01', amount: -4_500_000, currency: 'TRY', income: true },
      { date: '2026-10-05', amount: -10_000, currency: 'TRY', income: false },
    ] as const;
    expect(entries.map((e) => plain(formatEntryAmount(e.amount, 'TRY', 'en')))).toEqual([
      '₺500.00',
      '+₺45,000.00',
      '+₺100.00',
    ]);
    // Same figure as before the display change: charges minus refunds, income left out.
    expect(spendingInMonth(entries, '2026-10', 'TRY')).toBe(40_000);
  });
});
