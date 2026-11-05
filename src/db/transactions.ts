import {
  addMonths,
  firstDueMonth,
  hasCycle,
  monthOf,
  normalizeDescription,
  transactionFingerprint,
} from '../core/finance';
import type { Card, InstallmentPlan, IsoDate, Transaction } from '../types/domain';
import { db, newId } from './database';

export interface ManualEntry {
  card: Card;
  date: IsoDate;
  description: string;
  /** Positive minor units. */
  amount: number;
  /** Income is money coming into a debit card's account (D17); credit cards have none. */
  kind: 'charge' | 'refund' | 'income';
  /** 1 for a single payment; more creates an installment plan (charges only). */
  installments: number;
}

export const transactionsRepo = {
  /** Newest first. */
  async listByCard(cardId: string): Promise<Transaction[]> {
    const rows = await db.transactions.where('cardId').equals(cardId).toArray();
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  },

  listPlansByCard(cardId: string): Promise<InstallmentPlan[]> {
    return db.installmentPlans.where('cardId').equals(cardId).toArray();
  },

  /**
   * Saves a manually entered charge, refund or income (debit cards only). An installment
   * purchase is stored as one plan plus one linked purchase transaction (DECISIONS.md D11).
   */
  async addManual(entry: ManualEntry): Promise<string> {
    const { card, date, kind, installments } = entry;
    const description = entry.description.trim();
    if (!Number.isSafeInteger(entry.amount) || entry.amount <= 0) {
      throw new RangeError('Amount must be a positive integer in minor units');
    }
    if (kind !== 'charge' && installments !== 1) {
      throw new RangeError('Only charges can be split into installments');
    }
    if (kind === 'income' && card.type !== 'debit') {
      throw new RangeError('Only debit cards have income (D17)');
    }

    const amount = kind === 'charge' ? entry.amount : -entry.amount;
    const transaction: Transaction = {
      id: newId(),
      cardId: card.id,
      date,
      description,
      normalizedMerchant: normalizeDescription(description),
      amount,
      currency: card.currency,
      category: 'uncategorized',
      fingerprint: transactionFingerprint(card.id, date, amount, description),
      source: 'manual',
      ...(kind === 'income' ? { income: true } : {}),
    };

    if (installments === 1) {
      await db.transactions.add(transaction);
      return transaction.id;
    }
    if (card.type !== 'credit') {
      throw new RangeError('Debit cards have no installments (D13)');
    }

    const plan: InstallmentPlan = {
      id: newId(),
      cardId: card.id,
      description,
      totalAmount: amount,
      count: installments,
      purchaseDate: date,
      // Without statement days, the first installment is due the month after (D20).
      firstDueMonth: hasCycle(card)
        ? firstDueMonth(date, card.statementDay, card.dueDay)
        : addMonths(monthOf(date), 1),
      currency: card.currency,
    };
    await db.transaction('rw', db.transactions, db.installmentPlans, async () => {
      await db.installmentPlans.add(plan);
      await db.transactions.add({ ...transaction, installmentPlanId: plan.id });
    });
    return transaction.id;
  },

  /** Removes a transaction; removing an installment purchase also removes its plan. */
  async remove(id: string): Promise<void> {
    await db.transaction('rw', db.transactions, db.installmentPlans, async () => {
      const transaction = await db.transactions.get(id);
      if (!transaction) return;
      if (transaction.installmentPlanId) {
        await db.transactions
          .where('installmentPlanId')
          .equals(transaction.installmentPlanId)
          .delete();
        await db.installmentPlans.delete(transaction.installmentPlanId);
      } else {
        await db.transactions.delete(id);
      }
    });
  },
};
