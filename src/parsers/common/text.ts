/**
 * Lower-cases with Turkish rules and folds accents (ı→i, ş→s, ö→o…) but keeps
 * punctuation, so markers like "3/6" survive. Bank exports mix "ÖDEME" and "ODEME".
 */
export function foldText(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
