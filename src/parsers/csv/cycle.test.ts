import { readStatementCycle } from './cycle';

describe('readStatementCycle (D20)', () => {
  it('reads the statement and due days from the lines above the header', () => {
    const rows = [
      ['Kart Numarası', '5555 **** **** 1234'],
      ['Hesap Kesim Tarihi', '10.10.2026'],
      ['Son Ödeme Tarihi', '', '20.10.2026'],
      ['İşlem Tarihi', 'Açıklama', 'Tutar (TL)'],
      ['12.09.2026', 'Son ödeme tarihi', '25.09.2026'],
    ];
    expect(readStatementCycle(rows, 3)).toEqual({ statementDay: 10, dueDay: 20 });
  });

  it('reads a value after a colon in the same cell, and English labels', () => {
    expect(
      readStatementCycle(
        [['Statement date: 2026-11-05'], ['Payment due date: 2026-11-15'], ['Date']],
        2,
      ),
    ).toEqual({ statementDay: 5, dueDay: 15 });
  });

  it('returns only what the file states', () => {
    expect(readStatementCycle([['Hesap Kesim Tarihi', '10.10.2026'], ['Tarih']], 1)).toEqual({
      statementDay: 10,
    });
    expect(readStatementCycle([['Tarih', 'Açıklama']], 0)).toEqual({});
  });

  it('ignores a label without a valid date', () => {
    expect(readStatementCycle([['Son Ödeme Tarihi', 'yok'], ['Tarih']], 1)).toEqual({});
  });
});
