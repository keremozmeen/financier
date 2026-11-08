import type {
  Card,
  InstallmentPlan,
  IsoDate,
  Transaction,
  TransactionSource,
} from '../../types/domain';
import { normalizeDescription } from '../finance';
import { signedAmount } from './draft';
import type { PlannedRow } from './plan';

type NewTransaction = Omit<Transaction, 'id' | 'importId' | 'installmentPlanId'>;

/** What an import writes, before ids are assigned (D16). */
export interface ImportChanges {
  transactions: NewTransaction[];
  /** Plans for slices with no plan yet, each with its purchase transaction (D11). */
  plans: { plan: Omit<InstallmentPlan, 'id' | 'importId'>; purchase: NewTransaction }[];
  /** Bill payments, in date order, on credit card `cardId` against the statement closing on `periodEnd`. */
  payments: { cardId: string; date: IsoDate; amount: number; periodEnd: IsoDate }[];
  /** Merged manual entries that take the bank's description (D3). */
  merges: { transactionId: string; description: string }[];
  /** Linked plans without a description that take the bank's (D16). */
  links: { planId: string; description: string }[];
}

export function importChanges(
  planned: readonly PlannedRow[],
  card: Card,
  source: Exclude<TransactionSource, 'manual'>,
): ImportChanges {
  const changes: ImportChanges = {
    transactions: [],
    plans: [],
    payments: [],
    merges: [],
    links: [],
  };
  const entry = (
    date: IsoDate,
    description: string,
    amount: number,
    fingerprint: string,
    category = 'uncategorized',
  ) => ({
    cardId: card.id,
    date,
    description,
    normalizedMerchant: normalizeDescription(description),
    amount,
    currency: card.currency,
    category,
    fingerprint,
    source,
  });

  for (const { row, outcome } of planned) {
    const description = row.description.trim();
    switch (outcome.kind) {
      case 'add':
        changes.transactions.push({
          ...entry(row.date!, description, signedAmount(row), outcome.fingerprint, row.category),
          ...(outcome.flag ? { [outcome.flag]: true } : {}),
        });
        break;
      case 'newPlan':
        changes.plans.push({
          plan: {
            cardId: card.id,
            description,
            totalAmount: outcome.totalAmount,
            count: outcome.count,
            purchaseDate: row.date!,
            firstDueMonth: outcome.firstDueMonth,
            currency: card.currency,
          },
          purchase: entry(
            row.date!,
            description,
            outcome.totalAmount,
            outcome.fingerprint,
            row.category,
          ),
        });
        break;
      case 'payment':
        changes.payments.push({
          cardId: outcome.cardId,
          date: row.date!,
          amount: row.amount!,
          periodEnd: outcome.periodEnd,
        });
        break;
      case 'merge':
        if (outcome.fillDescription && description) {
          changes.merges.push({ transactionId: outcome.transactionId, description });
        }
        break;
      case 'link':
        if (outcome.fillDescription && description) {
          changes.links.push({ planId: outcome.planId, description });
        }
        break;
      default:
        break;
    }
  }
  changes.payments.sort((a, b) => a.date.localeCompare(b.date));
  return changes;
}
