import { createContext, useContext } from 'react';
import type { MessageKey } from './en';
import type { Locale } from './locales';

export interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
}

export const I18nContext = createContext<I18nValue | null>(null);

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}

export function useT(): I18nValue['t'] {
  return useI18n().t;
}
