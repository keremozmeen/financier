import { en } from './en';
import { dictionaries, isLocale, matchLocale, LOCALES } from './locales';

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
