import { en } from './en';
import { dictionaries, isLocale, matchLocale, LOCALES, translate } from './locales';

describe('matchLocale', () => {
  it('picks Turkish for any tr tag', () => {
    expect(matchLocale(['tr-TR', 'en-US'])).toBe('tr');
    expect(matchLocale(['TR'])).toBe('tr');
  });

  it('respects the order of preference', () => {
    expect(matchLocale(['en-GB', 'tr-TR'])).toBe('en');
  });

  it('skips unsupported languages', () => {
    expect(matchLocale(['de-DE', 'tr'])).toBe('tr');
  });

  it('falls back to English', () => {
    expect(matchLocale([])).toBe('en');
    expect(matchLocale(['fr-FR'])).toBe('en');
  });
});

describe('translate', () => {
  it('fills placeholders and leaves unknown ones untouched', () => {
    expect(translate('en', 'cards.source.override', { date: 'Nov 2, 2026' })).toBe(
      'From your bank balance on Nov 2, 2026',
    );
    expect(translate('en', 'cards.source.override')).toContain('{date}');
  });
});

describe('dictionary placeholders', () => {
  it.each(Object.keys(en) as (keyof typeof en)[])('%s uses the same placeholders in tr', (key) => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    expect(names(dictionaries.tr[key])).toEqual(names(en[key]));
  });
});

describe('isLocale', () => {
  it('accepts only supported locales', () => {
    expect(isLocale('tr')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});

describe('dictionaries', () => {
  const keys = Object.keys(en).sort();

  it.each(LOCALES)('%s has exactly the English keys and no empty strings', (locale) => {
    const dict = dictionaries[locale];
    expect(Object.keys(dict).sort()).toEqual(keys);
    for (const value of Object.values(dict)) expect(value.trim()).not.toBe('');
  });
});
