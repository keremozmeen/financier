import type { CurrencyCode } from '../../types/domain';

export const SUPPORTED_CURRENCIES = ['TRY', 'USD', 'EUR'] as const;

const digitsCache = new Map<string, number>();

/** Number of minor-unit digits for a currency (2 for TRY, USD and EUR). */
export function minorUnitDigits(currency: CurrencyCode): number {
  let digits = digitsCache.get(currency);
  if (digits === undefined) {
    digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits as number;
    digitsCache.set(currency, digits);
  }
  return digits;
}

/** Formats minor units for display, e.g. 123456 TRY → "₺1,234.56" (en) or "₺1.234,56" (tr). */
export function formatMoney(amount: number, currency: CurrencyCode, locale: string): string {
  assertMinorUnits(amount);
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    toDecimalString(amount, currency) as unknown as number,
  );
}

/** Formats minor units as a plain number for an input field, e.g. 123456 → "1234,56" (tr). */
export function formatMoneyInput(amount: number, currency: CurrencyCode, locale: string): string {
  assertMinorUnits(amount);
  const digits = minorUnitDigits(currency);
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(toDecimalString(amount, currency) as unknown as number);
}

/**
 * Parses a user-typed, non-negative amount into minor units without floating point.
 * The locale decides the separators ("1.234,56" in tr, "1,234.56" in en). The other
 * separator is also accepted as a decimal point when it appears once and is followed
 * by one or two digits ("12.5" in tr means 12,50). Returns null for invalid input.
 */
export function parseMoneyInput(
  input: string,
  currency: CurrencyCode,
  locale: string,
): number | null {
  const { decimal, group } = separators(locale);
  const cleaned = input.replace(/[\s\u00a0\u202f₺$€]|TRY|TL|USD|EUR/gi, '');
  if (!/^\d[\d.,]*$/.test(cleaned)) return null;

  let whole: string;
  let fraction = '';
  const parts = cleaned.split(decimal);
  if (parts.length > 2) return null;
  if (parts.length === 2) {
    whole = parts[0] as string;
    fraction = parts[1] as string;
  } else {
    const loose = new RegExp(`^(\\d+)\\${group}(\\d{1,2})$`).exec(cleaned);
    if (loose) {
      whole = loose[1] as string;
      fraction = loose[2] as string;
    } else {
      whole = cleaned;
    }
  }

  if (whole.includes(group)) {
    if (!new RegExp(`^\\d{1,3}(\\${group}\\d{3})+$`).test(whole)) return null;
    whole = whole.split(group).join('');
  }
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) return null;

  const digits = minorUnitDigits(currency);
  if (fraction.length > digits) return null;
  const value = Number(whole + fraction.padEnd(digits, '0'));
  return Number.isSafeInteger(value) ? value : null;
}

function separators(locale: string): { decimal: string; group: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234.5);
  const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.';
  return { decimal, group: decimal === ',' ? '.' : ',' };
}

/** Exact decimal string for minor units, e.g. 123456 → "1234.56", -5 → "-0.05". */
function toDecimalString(amount: number, currency: CurrencyCode): string {
  const digits = minorUnitDigits(currency);
  const sign = amount < 0 ? '-' : '';
  const abs = String(Math.abs(amount)).padStart(digits + 1, '0');
  if (digits === 0) return sign + abs;
  return `${sign}${abs.slice(0, -digits)}.${abs.slice(-digits)}`;
}

function assertMinorUnits(amount: number): void {
  if (!Number.isSafeInteger(amount)) {
    throw new TypeError(`Money amounts must be integer minor units, got ${amount}`);
  }
}
