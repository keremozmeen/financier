import { stripInstallmentMarker } from '../../parsers/common';

/**
 * Whether two descriptions name the same purchase (D16): ignoring installment markers,
 * one contains the other, they share their first word, or most of their words match.
 * "TEKNOSA ISTANBUL TAKSİT 3/6" is similar to "Teknosa".
 */
export function similarDescriptions(a: string, b: string): boolean {
  const x = stripInstallmentMarker(a);
  const y = stripInstallmentMarker(b);
  if (x.length < 3 || y.length < 3) return false;
  if (x.includes(y) || y.includes(x)) return true;

  const wordsX = words(x);
  const wordsY = words(y);
  if (wordsX.length === 0 || wordsY.length === 0) return false;
  if (wordsX[0] === wordsY[0]) return true;
  const shared = wordsX.filter((word) => wordsY.includes(word)).length;
  return shared / new Set([...wordsX, ...wordsY]).size >= 0.5;
}

/** Words of at least three characters that are not just digits. */
function words(text: string): string[] {
  return text.split(' ').filter((word) => word.length >= 3 && !/^\d+$/.test(word));
}
