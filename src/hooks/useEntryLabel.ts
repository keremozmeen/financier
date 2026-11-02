import { useCallback } from 'react';
import { useT } from '../i18n';
import type { Transaction } from '../types/domain';

/**
 * Display name for an entry: its description, or "Charge" / "Refund" /
 * "Installment purchase" when the user left the description empty (D3).
 */
export function useEntryLabel() {
  const t = useT();
  return useCallback(
    (tx: Pick<Transaction, 'description' | 'amount' | 'installmentPlanId'>) => {
      if (tx.description.trim()) return tx.description;
      if (tx.installmentPlanId) return t('tx.fallback.installment');
      return tx.amount < 0 ? t('tx.fallback.refund') : t('tx.fallback.charge');
    },
    [t],
  );
}
