import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { browserLanguages } from '../platform/locale';
import { readPreference, writePreference } from '../platform/storage';
import { I18nContext } from './context';
import type { MessageKey } from './en';
import { isLocale, matchLocale, translate, type Locale, type MessageParams } from './locales';

const STORAGE_KEY = 'financier.locale';

function initialLocale(): Locale {
  const saved = readPreference(STORAGE_KEY);
  return isLocale(saved) ? saved : matchLocale(browserLanguages());
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writePreference(STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: MessageKey, params?: MessageParams) => translate(locale, key, params),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
