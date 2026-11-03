import { detectDecimalSeparator, parseStatementAmount } from './numbers';

describe('parseStatementAmount', () => {
  it.each([
    ['1.234,56', 123_456],
    ['1.234.567,89', 123_456_789],
    ['1234,56', 123_456],
    ['0,99', 99],
    ['12,5', 1250],
    ['250', 25_000],
    ['-1.234,56', -123_456],
    ['+1.234,56', 123_456],
    ['1.234,56-', -123_456],
    ['(1.234,56)', -123_456],
    ['1.234,56 TL', 123_456],
    ['₺1.234,56', 123_456],
    ['- 45,00 TRY', -4500],
    ['1 234,56', 123_456],
    ['1.234', 123_400],
  ])('reads the Turkish amount %s', (input, expected) => {
    expect(parseStatementAmount(input, 'TRY', ',')).toBe(expected);
  });

  it.each([
    ['1,234.56', 123_456],
    ['-1,234.56', -123_456],
    ['$12.50', 1250],
    ['1234.5', 123_450],
  ])('reads the English amount %s', (input, expected) => {
    expect(parseStatementAmount(input, 'USD', '.')).toBe(expected);
  });

  it('guesses the separator for a single value when none is given', () => {
    expect(parseStatementAmount('1.234,56', 'TRY')).toBe(123_456);
    expect(parseStatementAmount('1,234.56', 'TRY')).toBe(123_456);
    expect(parseStatementAmount('12.50', 'TRY')).toBe(1250);
    expect(parseStatementAmount('1.250', 'TRY')).toBe(125_000);
    expect(parseStatementAmount('45,9', 'TRY')).toBe(4590);
  });

  it.each(['', '-', 'abc', '12,345', '1.23.4,00', '1,2,3', '12..5', 'TL'])(
    'rejects %j',
    (input) => {
      expect(parseStatementAmount(input, 'TRY', ',')).toBeNull();
    },
  );

  it('never returns negative zero', () => {
    expect(Object.is(parseStatementAmount('-0,00', 'TRY', ','), 0)).toBe(true);
  });
});

describe('detectDecimalSeparator', () => {
  it('detects Turkish and English columns', () => {
    expect(detectDecimalSeparator(['1.234,56', '45,00', '-12,30'])).toBe(',');
    expect(detectDecimalSeparator(['1,234.56', '45.00', '-12.30'])).toBe('.');
  });

  it('defaults to a comma when nothing decides', () => {
    expect(detectDecimalSeparator(['1.234', '250'])).toBe(',');
    expect(detectDecimalSeparator([])).toBe(',');
  });
});
