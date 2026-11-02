import type { BalanceOverride, Card, IsoDate } from '../types/domain';
import { db, newId } from './database';

export const balanceOverridesRepo = {
  /** Full history, newest entry first. The first one is the current override (D11). */
  async listByCard(cardId: string): Promise<BalanceOverride[]> {
    const rows = await db.balanceOverrides.where('cardId').equals(cardId).toArray();
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /** Records a new bank balance; it replaces the previous one as the current override. */
  async add(
    card: Pick<Card, 'id' | 'currency' | 'type'>,
    balance: number,
    asOf: IsoDate,
    now: Date = new Date(),
  ): Promise<string> {
    if (card.type !== 'credit') {
      throw new RangeError('Only credit cards have a bank balance override (D13)');
    }
    // A negative balance is a credit balance on the card (D15).
    if (!Number.isSafeInteger(balance)) {
      throw new RangeError('Balance must be an integer in minor units');
    }
    const id = newId();
    await db.balanceOverrides.add({
      id,
      cardId: card.id,
      balance,
      currency: card.currency,
      asOf,
      createdAt: now.toISOString(),
    });
    return id;
  },
};
