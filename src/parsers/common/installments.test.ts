import {
  parseInstallmentColumn,
  parseInstallmentMarker,
  stripInstallmentMarker,
} from './installments';

describe('parseInstallmentMarker', () => {
  it.each([
    ['TEKNOSA TAKSİT 3/6', 3, 6],
    ['TEKNOSA TAKSIT 03/06', 3, 6],
    ['TEKNOSA Taksit: 3 / 6', 3, 6],
    ['MEDIAMARKT 2/12 TAKSİT', 2, 12],
    ['MEDIAMARKT 3. TAKSİT/6', 3, 6],
    ['ZARA 6 TAKSİTİN 2. TAKSİDİ', 2, 6],
    ['APPLE STORE INSTALLMENT 4 OF 9', 4, 9],
    ['Apple inst. 4/9', 4, 9],
  ])('reads %s with a keyword', (text, index, count) => {
    expect(parseInstallmentMarker(text)).toEqual({ index, count, keyword: true });
  });

  it('reads a bare marker with lower certainty', () => {
    expect(parseInstallmentMarker('TEKNOSA ISTANBUL (3/6)')).toEqual({
      index: 3,
      count: 6,
      keyword: false,
    });
    expect(parseInstallmentMarker('TEKNOSA 3/6')).toMatchObject({ keyword: false });
  });

  it.each([
    'MIGROS 24/7 MARKET',
    'ODEME 12/05/2026',
    'MARKET 1/1',
    'HEPSIBURADA 0/6',
    'TAKSIT 3/48',
    'NETFLIX.COM',
    '7/24 ECZANE',
  ])('finds no marker in %s', (text) => {
    expect(parseInstallmentMarker(text)).toBeNull();
  });
});

describe('parseInstallmentColumn', () => {
  it('reads installment columns', () => {
    expect(parseInstallmentColumn('3/6')).toEqual({ index: 3, count: 6, keyword: true });
    expect(parseInstallmentColumn(' 03 / 06 ')).toEqual({ index: 3, count: 6, keyword: true });
    expect(parseInstallmentColumn('3 of 6')).toEqual({ index: 3, count: 6, keyword: true });
  });

  it.each(['', '6', '1/1', '7/6', 'peşin'])('ignores %j', (text) => {
    expect(parseInstallmentColumn(text)).toBeNull();
  });
});

describe('stripInstallmentMarker', () => {
  it('removes the marker and the word taksit', () => {
    expect(stripInstallmentMarker('TEKNOSA İSTANBUL TAKSİT 3/6')).toBe('teknosa istanbul');
    expect(stripInstallmentMarker('Teknosa (3/6)')).toBe('teknosa');
    expect(stripInstallmentMarker('NETFLIX')).toBe('netflix');
  });
});
