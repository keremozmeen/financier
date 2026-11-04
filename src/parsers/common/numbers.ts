import { minorUnitDigits } from '../../core/finance';
import type { CurrencyCode } from '../../types/domain';

export type DecimalSeparator = ',' | '.';

const CURRENCY_MARKS = /[\s\u00a0\u202f₺$€£]|\b(?:TRY|TL|YTL|USD|EUR|GBP)\b/gi;

/**
 * Parses an amount as printed in a bank export into signed minor units, without
 * floating point. Handles Turkish ("1.234,56") and English ("1,234.56") separators,
 * a leading or trailing minus ("-1.234,56", "1.234,56-"), parentheses for negatives
 * and currency marks ("1.234,56 TL"). `decimal` is the file's decimal separator
 * (see detectDecimalSeparator); without it a lone comma is taken as the Turkish
 * decimal comma. Returns null when the text is not an amount.
 */
export function parseStatementAmount(
  input: string,
  currency: CurrencyCode,
  decimal?: DecimalSeparator,
): number | null {
  let text = input.replace(CURRENCY_MARKS, '');
  if (text === '') return null;

  let negative = false;
  const parens = /^\((.*)\)$/.exec(text);
  if (parens) {
    negative = true;
    text = parens[1] as string;
  }
  if (/^[-+]/.test(text)) {
    negative = negative !== (text[0] === '-');
    text = text.slice(1);
  } else if (/-$/.test(text)) {
    negative = !negative;
    text = text.slice(0, -1);
  }
  if (!/^\d[\d.,]*$/.test(text)) return null;

  const sep = decimal ?? guessDecimal(text);
  const group = sep === ',' ? '.' : ',';
  const parts = text.split(sep);
  if (parts.length > 2) return null;
  let whole = parts[0] as string;
  const fraction = parts[1] ?? '';

  if (whole.includes(group)) {
    if (!new RegExp(`^\\d{1,3}(\\${group}\\d{3})+$`).test(whole)) return null;
    whole = whole.split(group).join('');
  }
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) return null;

  const digits = minorUnitDigits(currency);
  if (fraction.length > digits) return null;
  const value = Number(whole + fraction.padEnd(digits, '0'));
  if (!Number.isSafeInteger(value)) return null;
  return negative && value !== 0 ? -value : value;
}

/** For a single value: with both separators the last one is decimal; otherwise a comma. */
function guessDecimal(text: string): DecimalSeparator {
  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) return comma > dot ? ',' : '.';
  if (dot >= 0 && !/^\d{1,3}(\.\d{3})+$/.test(text)) return '.';
  return ',';
}

/**
 * The decimal separator a column of amounts uses. A value with both separators, or one
 * separator followed by one or two digits, decides; "1.234" alone is ambiguous. Turkish
 * banks use a comma, so that is the default when nothing decides.
 */
export function detectDecimalSeparator(samples: readonly string[]): DecimalSeparator {
  let comma = 0;
  let dot = 0;
  for (const sample of samples) {
    const text = sample.replace(CURRENCY_MARKS, '').replace(/[()+-]/g, '');
    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');
    if (lastComma >= 0 && lastDot >= 0) {
      if (lastComma > lastDot) comma++;
      else dot++;
    } else if (/,\d{1,2}$/.test(text)) comma++;
    else if (/\.\d{1,2}$/.test(text)) dot++;
  }
  return dot > comma ? '.' : ',';
}
