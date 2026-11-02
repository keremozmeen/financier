import { useMemo } from 'react';
import { formatDate, formatMoney } from '../core/finance';
import { useI18n } from '../i18n';
import type { CurrencyCode, IsoDate } from '../types/domain';

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
      date: (date: IsoDate) => formatDate(date, locale),
      percent: (ratio: number) => percentFormat.format(ratio),
    };
  }, [locale]);
}
