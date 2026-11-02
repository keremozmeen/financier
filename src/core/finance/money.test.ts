import { formatMoney, formatMoneyInput, minorUnitDigits, parseMoneyInput } from './money';

// Intl inserts non-breaking spaces in some locales; compare with plain spaces.
const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('minorUnitDigits', () => {
  it('is 2 for the supported currencies', () => {
    expect(minorUnitDigits('TRY')).toBe(2);
    expect(minorUnitDigits('USD')).toBe(2);
    expect(minorUnitDigits('EUR')).toBe(2);
  });
});

describe('formatMoney', () => {
  it('formats per locale (D2)', () => {
    expect(plain(formatMoney(123456, 'TRY', 'tr'))).toBe('₺1.234,56');
    expect(plain(formatMoney(123456, 'TRY', 'en'))).toBe('₺1,234.56');
    expect(plain(formatMoney(123456, 'USD', 'en'))).toBe('$1,234.56');
  });

  it('keeps sub-unit amounts and negatives exact', () => {
    expect(plain(formatMoney(5, 'TRY', 'tr'))).toBe('₺0,05');
    expect(plain(formatMoney(-150000, 'TRY', 'tr'))).toBe('-₺1.500,00');
  });

  it('stays exact for amounts where floats would drift', () => {
    expect(plain(formatMoney(1_000_000_000_001, 'USD', 'en'))).toBe('$10,000,000,000.01');
  });

  it('rejects non-integer amounts', () => {
    expect(() => formatMoney(12.5, 'TRY', 'tr')).toThrow(TypeError);
  });
});

describe('formatMoneyInput', () => {
  it('formats without symbol or grouping', () => {
    expect(formatMoneyInput(123456, 'TRY', 'tr')).toBe('1234,56');
    expect(formatMoneyInput(123456, 'TRY', 'en')).toBe('1234.56');
    expect(formatMoneyInput(100, 'TRY', 'tr')).toBe('1,00');
  });
});

describe('parseMoneyInput', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1234', 123400],
    ['1.234', 123400],
    ['12,5', 1250],
    ['12.5', 1250],
    ['12.50', 1250],
    ['0,05', 5],
    ['1.234.567,89', 123456789],
    ['₺ 1.234,56', 123456],
    ['1.234,56 TL', 123456],
  ])('tr: %s → %i', (input, expected) => {
    expect(parseMoneyInput(input, 'TRY', 'tr')).toBe(expected);
  });

  it.each([
    ['1,234.56', 123456],
    ['1234.56', 123456],
    ['1,234', 123400],
    ['12,5', 1250],
    ['$1,234.56', 123456],
  ])('en: %s → %i', (input, expected) => {
    expect(parseMoneyInput(input, 'USD', 'en')).toBe(expected);
  });

  it.each(['', 'abc', '-5', '1,2,3', '12,345', '1.23.4', '1,234,56', '1,999'])(
    'tr rejects %j',
    (input) => {
      expect(parseMoneyInput(input, 'TRY', 'tr')).toBeNull();
    },
  );

  it('rejects more fraction digits than the currency has', () => {
    expect(parseMoneyInput('1,234', 'TRY', 'tr')).toBeNull();
    expect(parseMoneyInput('1.234', 'USD', 'en')).toBeNull();
  });

  it('rejects amounts beyond safe integers', () => {
    expect(parseMoneyInput('99999999999999999', 'TRY', 'tr')).toBeNull();
  });

  it('round-trips with formatMoneyInput', () => {
    for (const locale of ['tr', 'en']) {
      for (const amount of [0, 5, 100, 123456, 987654321]) {
        expect(parseMoneyInput(formatMoneyInput(amount, 'TRY', locale), 'TRY', locale)).toBe(
          amount,
        );
      }
    }
  });
});
