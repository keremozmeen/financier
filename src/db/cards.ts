import type { Card, CreditCard, DebitCard } from '../types/domain';
import { db, newId } from './database';

/** A card as entered in the form; keeps the credit/debit union intact. */
export type CardInput = Omit<CreditCard, 'id' | 'archived'> | Omit<DebitCard, 'id' | 'archived'>;

export const cardsRepo = {
  /** Active cards by default, sorted by name. */
  async list({ includeArchived = false } = {}): Promise<Card[]> {
    const cards = await db.cards.toArray();
    return cards
      .filter((card) => includeArchived || !card.archived)
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  },

  get(id: string): Promise<Card | undefined> {
    return db.cards.get(id);
  },

  async create(input: CardInput): Promise<string> {
    const id = newId();
    await db.cards.add({ ...input, id, archived: false });
    return id;
  },

  /**
   * Replaces the card's fields with the form input. A full replace (not a merge) so a
   * card changed from credit to debit does not keep a stale limit or statement day.
   */
  async update(id: string, input: CardInput): Promise<void> {
    await db.transaction('rw', db.cards, async () => {
      const existing = await db.cards.get(id);
      if (!existing) throw new Error(`Card ${id} not found`);
      await db.cards.put({ ...input, id, archived: existing.archived });
    });
  },

  async setArchived(id: string, archived: boolean): Promise<void> {
    await db.cards.update(id, { archived });
  },

  /** Permanently removes the card and everything recorded on it. */
  async deletePermanently(id: string): Promise<void> {
    await db.transaction(
      'rw',
      [db.cards, db.transactions, db.installmentPlans, db.balanceOverrides, db.statements],
      async () => {
        await db.transactions.where('cardId').equals(id).delete();
        await db.installmentPlans.where('cardId').equals(id).delete();
        await db.balanceOverrides.where('cardId').equals(id).delete();
        await db.statements.where('cardId').equals(id).delete();
        await db.cards.delete(id);
      },
    );
  },

  /** How much data a permanent delete would remove, for the confirmation dialog. */
  async countRecords(id: string): Promise<{ transactions: number; overrides: number }> {
    const [transactions, overrides] = await Promise.all([
      db.transactions.where('cardId').equals(id).count(),
      db.balanceOverrides.where('cardId').equals(id).count(),
    ]);
    return { transactions, overrides };
  },
};
