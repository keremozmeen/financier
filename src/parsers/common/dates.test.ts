import { detectDateOrder, parseStatementDate } from './dates';

describe('parseStatementDate', () => {
  it.each([
    ['26.10.2026', '2026-10-26'],
    ['26/10/2026', '2026-10-26'],
    ['26-10-2026', '2026-10-26'],
    ['6.1.2026', '2026-01-06'],
    ['26.10.26', '2026-10-26'],
    ['2026-10-26', '2026-10-26'],
    ['2026-10-26T14:30:00', '2026-10-26'],
    ['26.10.2026 14:35', '2026-10-26'],
    ['03.11.2026 14:22:05', '2026-11-03'],
    ['03.11.2026-14:22', '2026-11-03'],
    ['03/11/2026 14.22', '2026-11-03'],
    ['2026-11-03 14:22', '2026-11-03'],
    ['26 Ekim 2026', '2026-10-26'],
    ['26 EKİM 2026', '2026-10-26'],
    ['3 Şubat 2026', '2026-02-03'],
    ['3 ŞUB 2026', '2026-02-03'],
    ['15 Ağustos 2026', '2026-08-15'],
    ['1 Ara. 2026', '2026-12-01'],
    ['Oct 26, 2026', '2026-10-26'],
    ['26 October 2026', '2026-10-26'],
  ])('reads %s', (input, expected) => {
    expect(parseStatementDate(input)).toBe(expected);
  });

  it('uses the given order for numeric dates', () => {
    expect(parseStatementDate('10/26/2026', 'MDY')).toBe('2026-10-26');
    expect(parseStatementDate('03.04.2026', 'DMY')).toBe('2026-04-03');
    expect(parseStatementDate('03.04.2026', 'MDY')).toBe('2026-03-04');
    expect(parseStatementDate('26.10.03', 'YMD')).toBe('2026-10-03');
  });

  it.each(['', '31.02.2026', '32.01.2026', '26.13.2026', '26 Foo 2026', '26.10.226', 'abc'])(
    'rejects %j',
    (input) => {
      expect(parseStatementDate(input)).toBeNull();
    },
  );
});

describe('detectDateOrder', () => {
  it('detects the order from unambiguous samples', () => {
    expect(detectDateOrder(['03.04.2026', '26.04.2026'])).toBe('DMY');
    expect(detectDateOrder(['04/03/2026', '04/26/2026'])).toBe('MDY');
    expect(detectDateOrder(['2026-04-03'])).toBe('YMD');
  });

  it('defaults to day first', () => {
    expect(detectDateOrder(['03.04.2026'])).toBe('DMY');
    expect(detectDateOrder([])).toBe('DMY');
  });
});
