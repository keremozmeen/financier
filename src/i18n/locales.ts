import { en, type MessageKey } from './en';
import { tr } from './tr';

export const LOCALES = ['en', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];

export const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, tr };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Picks the first supported locale from the browser's preference list. */
export function matchLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return 'en';
}

export function translate(locale: Locale, key: MessageKey): string {
  return dictionaries[locale][key];
}
