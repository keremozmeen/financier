import { displayName, merchantKey } from './merchant';

describe('merchantKey (D19)', () => {
  it.each([
    'NETFLIX.COM',
    'NETFLIX COM ISTANBUL',
    'IYZICO *NETFLIX',
    'Netflix.com 4829',
    'www.netflix.com.tr',
  ])('reads %s as netflix', (description) => {
    expect(merchantKey(description)).toBe('netflix');
  });

  it('drops reference codes and city names', () => {
    expect(merchantKey('SPOTIFY P1A2B3C4')).toBe('spotify');
    expect(merchantKey('SPOTIFY STOCKHOLM')).toBe('spotify');
    expect(merchantKey('PAYTR *EXXEN TV')).toBe('exxen');
  });

  it('keeps the service after a platform that bills several', () => {
    expect(merchantKey('GOOGLE *YOUTUBE PREMIUM')).toBe('google youtube');
    expect(merchantKey('GOOGLE *GOOGLE ONE')).toBe('google one');
    expect(merchantKey('APPLE.COM/BILL')).toBe('apple bill');
    expect(merchantKey('AMAZON PRIME TR')).toBe('amazon prime');
  });

  it('folds Turkish letters', () => {
    expect(merchantKey('TÜRK TELEKOM')).toBe('turk telekom');
    expect(merchantKey('Türk Telekom A.Ş.')).toBe('turk telekom');
    expect(merchantKey('İGDAŞ')).toBe('igdas');
  });

  it('keeps a processor name when nothing follows it', () => {
    expect(merchantKey('IYZICO')).toBe('iyzico');
  });

  it('is empty when nothing names a merchant', () => {
    expect(merchantKey('')).toBe('');
    expect(merchantKey('  12345 / 678 ')).toBe('');
  });
});

describe('displayName (D19)', () => {
  it.each([
    ['IYZICO *NETFLIX.COM', 'Netflix'],
    ['GOOGLE *YOUTUBE PREMIUM', 'YouTube Premium'],
    ['OPENAI *CHATGPT SUBSCR', 'ChatGPT'],
    ['APPLE.COM/BILL', 'Apple'],
    ['IGDAS DOGALGAZ', 'İGDAŞ'],
    ['TURKCELL FATURA', 'Turkcell'],
  ])('names %s as %s', (description, name) => {
    expect(displayName(description)).toBe(name);
  });

  it('title-cases unknown merchants without billing words, processors or references', () => {
    expect(displayName('KAHVE DÜNYASI ABONELİK')).toBe('Kahve Dünyası');
    expect(displayName('KAHVE DUNYASI ABONELIK')).toBe('Kahve Dunyasi');
    expect(displayName('PAYTR *ACME SPOR KULUBU 4829')).toBe('Acme Spor Kulubu');
    expect(displayName('ENERJISA ELEKTRIK FATURA')).toBe('Enerjisa');
  });

  it('falls back to the bank text when nothing is left', () => {
    expect(displayName('ABONELIK 123')).toBe('ABONELIK 123');
  });
});
