import { isIsoDate } from '../../core/finance';
import type { IsoDate } from '../../types/domain';
import { foldText } from './text';

/** Order of day, month and year in a numeric date. Turkish banks use DMY. */
export type DateOrder = 'DMY' | 'MDY' | 'YMD';

// Folded (accent-free, lower-case) month names and abbreviations, Turkish then English.
const MONTHS: Record<string, number> = {};
[
  ['ocak', 'oca', 'january', 'jan'],
  ['subat', 'sub', 'february', 'feb'],
  ['mart', 'mar', 'march'],
  ['nisan', 'nis', 'april', 'apr'],
  ['mayis', 'may'],
  ['haziran', 'haz', 'june', 'jun'],
  ['temmuz', 'tem', 'july', 'jul'],
  ['agustos', 'agu', 'august', 'aug'],
  ['eylul', 'eyl', 'september', 'sep', 'sept'],
  ['ekim', 'eki', 'october', 'oct'],
  ['kasim', 'kas', 'november', 'nov'],
  ['aralik', 'ara', 'december', 'dec'],
].forEach((names, i) => names.forEach((name) => (MONTHS[name] = i + 1)));

/**
 * Parses a date as printed in a bank export: "26.10.2026", "26/10/26", "26-10-2026",
 * "2026-10-26", "26 Ekim 2026", "26 Eki 2026", "Oct 26, 2026", optionally followed by
 * a time. `order` resolves numeric dates; a four-digit first part is always year first.
 * Returns null when the text is not a valid date.
 */
export function parseStatementDate(input: string, order: DateOrder = 'DMY'): IsoDate | null {
  // A time after the date ("03.11.2026 14:22", "2026-11-03T14:22", "03.11.2026-14:22:05") is dropped.
  const text = foldText(input).replace(
    /[\s t/-]+\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*$|[ t]\d{1,2}:\d{2}.*$/,
    '',
  );

  const numeric = /^(\d{1,4})[./-](\d{1,2})[./-](\d{2,4})$/.exec(text);
  if (numeric) {
    const [a, b, c] = numeric.slice(1).map(Number) as [number, number, number];
    if ((numeric[1] as string).length === 4) return toIso(a, b, c);
    if ((numeric[3] as string).length === 3) return null;
    if (order === 'YMD') return toIso(expandYear(a, numeric[1] as string), b, c);
    const year = expandYear(c, numeric[3] as string);
    return order === 'MDY' ? toIso(year, a, b) : toIso(year, b, a);
  }

  const dayFirst = /^(\d{1,2})\.? ([a-z]+)\.?,? (\d{4})$/.exec(text);
  if (dayFirst) {
    const month = MONTHS[dayFirst[2] as string];
    return month ? toIso(Number(dayFirst[3]), month, Number(dayFirst[1])) : null;
  }
  const monthFirst = /^([a-z]+)\.? (\d{1,2}),? (\d{4})$/.exec(text);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1] as string];
    return month ? toIso(Number(monthFirst[3]), month, Number(monthFirst[2])) : null;
  }
  return null;
}

/**
 * The order a column of numeric dates uses: a first part above 12 means day first, a
 * second part above 12 means month first, a four-digit first part means year first.
 * Defaults to DMY, the Turkish order.
 */
export function detectDateOrder(samples: readonly string[]): DateOrder {
  let dmy = 0;
  let mdy = 0;
  for (const sample of samples) {
    const match = /^\s*(\d{1,4})[./-](\d{1,2})[./-](\d{2,4})/.exec(sample);
    if (!match) continue;
    if ((match[1] as string).length === 4) return 'YMD';
    if (Number(match[1]) > 12) dmy++;
    else if (Number(match[2]) > 12) mdy++;
  }
  return mdy > dmy ? 'MDY' : 'DMY';
}

function expandYear(year: number, digits: string): number {
  return digits.length === 2 ? 2000 + year : year;
}

function toIso(year: number, month: number, day: number): IsoDate | null {
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isIsoDate(iso) ? iso : null;
}
