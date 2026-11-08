import {
  categoryMerchantKey,
  isProcessorKey,
  merchantKey,
  merchantLabel,
  merchantWords,
} from './merchant';

describe('merchantWords (D22)', () => {
  it('keeps short names with digits and drops reference codes', () => {
    expect(merchantWords('A101 YENI MAGAZACILIK A.S.')).toEqual(['a101', 'yeni']);
    expect(merchantWords('N11.COM ISTANBUL')).toEqual(['n11']);
    expect(merchantWords('SPOTIFY P1A2B3C4')).toEqual(['spotify']);
    expect(merchantWords('MIGROS 4829 123456')).toEqual(['migros']);
  });

  it('drops processors, company words, cities and installment markers', () => {
    expect(merchantWords('IYZICO *ABC GIDA SAN. TİC. LTD. ŞTİ. KARTAL')).toEqual(['abc']);
    expect(merchantWords('MEDIAMARKT TAKSIT 3/6')).toEqual(['mediamarkt']);
    expect(merchantWords('POS SANAL PAYCELL TEKNOSA')).toEqual(['teknosa']);
  });

  it('keeps names written with an ampersand as one word', () => {
    expect(merchantWords('H&M ISTINYE')).toContain('hnm');
    expect(merchantWords('D & R KITAP')).toContain('dnr');
  });

  it('folds case and Turkish letters', () => {
    expect(merchantWords('MİGROS KADIKÖY')).toEqual(['migros']);
    expect(merchantWords('şok market')).toEqual(['sok', 'market']);
  });

  it('is empty when only a processor or noise is left', () => {
    expect(merchantWords('IYZICO')).toEqual([]);
    expect(merchantWords('LTD STI 1234')).toEqual([]);
    expect(merchantWords('')).toEqual([]);
  });
});

describe('categoryMerchantKey (D22)', () => {
  it('reads the merchant behind a processor, digits included', () => {
    expect(categoryMerchantKey('IYZICO/4AOTOMAT.COM ISTANBUL 3411')).toBe('4aotomat');
  });

  it('keeps the service after a platform', () => {
    expect(categoryMerchantKey('GOOGLE *YOUTUBE PREMIUM')).toBe('google youtube');
  });

  it('is empty for a bare processor, so no rule can catch every shop using it', () => {
    expect(categoryMerchantKey('IYZICO 1234')).toBe('');
  });

  it('leaves the Sub-Radar key as it was', () => {
    expect(merchantKey('IYZICO/4AOTOMAT.COM ISTANBUL 3411')).toBe('iyzico');
    expect(merchantKey('A101 YENI MAGAZACILIK')).toBe('yeni');
  });
});

describe('isProcessorKey', () => {
  it('tells processors from merchants', () => {
    expect(isProcessorKey('iyzico')).toBe(true);
    expect(isProcessorKey('netflix')).toBe(false);
  });
});

describe('merchantLabel', () => {
  it('shows names with digits as they are written', () => {
    expect(merchantLabel('A101 YENI MAGAZACILIK')).toBe('A101');
  });

  it('otherwise uses the display name', () => {
    expect(merchantLabel('IYZICO *NETFLIX.COM')).toBe('Netflix');
    expect(merchantLabel('KAHVE DÜNYASI KADIKÖY')).toBe('Kahve Dünyası');
  });
});
