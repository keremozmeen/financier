import type { IsoDate } from '../../types/domain';

/**
 * Matching key for a description: lower-case, accents and punctuation removed,
 * single-spaced. Bank statements are often upper-case ASCII ("MIGROS KADIKOY"),
 * so ı/i and ş/s etc. are folded together to match "Migros Kadıköy".
 */
export function normalizeDescription(description: string): string {
  return description
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Duplicate-protection key: cardId + date + amount + normalized description (D3). */
export function transactionFingerprint(
  cardId: string,
  date: IsoDate,
  amount: number,
  description: string,
): string {
  return [cardId, date, amount, normalizeDescription(description)].join('|');
}
