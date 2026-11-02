import { computeCardUsage, type CardUsageInput } from './usage';

export interface SpendRequest {
  kind: 'charge' | 'refund';
  /** Positive minor units; for an installment purchase, the full total (D11 blocks all of it). */
  amount: number;
}

export type SpendCheck = { allowed: true } | { allowed: false; available: number };

/**
 * D12: Turkish banks decline a purchase above the available limit, so such a charge
 * is blocked in the entry form. Refunds are always allowed. When editing, pass the
 * edited transaction's id as `excluding`: it and its installment plan are left out,
 * so the new amount is checked against the limit available without the entry.
 */
export function checkSpendAllowed(
  input: CardUsageInput,
  request: SpendRequest,
  excluding?: string,
): SpendCheck {
  if (request.kind === 'refund') return { allowed: true };

  const edited = excluding ? input.transactions.find((tx) => tx.id === excluding) : undefined;
  const { available } = computeCardUsage(
    edited
      ? {
          ...input,
          transactions: input.transactions.filter((tx) => tx !== edited),
          plans: input.plans.filter(
            (plan) => !edited.installmentPlanId || plan.id !== edited.installmentPlanId,
          ),
        }
      : input,
  );

  return request.amount <= available ? { allowed: true } : { allowed: false, available };
}
