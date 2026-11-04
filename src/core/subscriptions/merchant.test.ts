import { merchantKey } from './merchant';

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
