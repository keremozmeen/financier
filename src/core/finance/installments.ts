export const MAX_INSTALLMENTS = 36;

/**
 * Splits a total into `count` installments. When it does not divide evenly the
 * remainder goes on the first installment, as Turkish banks bill (D2).
 * 1000 / 3 → [334, 333, 333].
 */
export function splitInstallments(total: number, count: number): number[] {
  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new RangeError(`Installment total must be a positive integer, got ${total}`);
  }
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS) {
    throw new RangeError(`Installment count must be 1–${MAX_INSTALLMENTS}, got ${count}`);
  }
  const base = Math.floor(total / count);
  const amounts = Array.from({ length: count }, () => base);
  amounts[0] = base + (total - base * count);
  return amounts;
}

/** Total still owed on a plan after `paidCount` installments have been paid. */
export function remainingPlanBalance(total: number, count: number, paidCount: number): number {
  const amounts = splitInstallments(total, count);
  const paid = Math.min(Math.max(paidCount, 0), count);
  return amounts.slice(paid).reduce((sum, amount) => sum + amount, 0);
}
