import { useMemo } from 'react';
import { formatDate, formatEntryAmount, formatMoney } from '../core/finance';
import { useI18n } from '../i18n';
import type { CurrencyCode, IsoDate, IsoMonth } from '../types/domain';

/** Locale-aware formatters for the active language. */
export function useFormat() {
  const { locale } = useI18n();
  return useMemo(() => {
    const percentFormat = new Intl.NumberFormat(locale, {
      style: 'percent',
      maximumFractionDigits: 0,
    });
    return {
      locale,
      money: (amount: number, currency: CurrencyCode) => formatMoney(amount, currency, locale),
      /** One stored entry: spending plain, money in with "+" (see `formatEntryAmount`). */
      entry: (amount: number, currency: CurrencyCode) =>
        formatEntryAmount(amount, currency, locale),
      date: (date: IsoDate) => formatDate(date, locale),
      /** "20 Kas" / "Nov 20": a date in the next weeks, without the year. */
      month: (month: IsoMonth) => formatDate(`${month}-01`, locale, { month: 'short' }),
      dayMonth: (date: IsoDate) => formatDate(date, locale, { day: 'numeric', month: 'short' }),
      percent: (ratio: number) => percentFormat.format(ratio),
    };
  }, [locale]);
}
