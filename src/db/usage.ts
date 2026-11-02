import { computeCardUsage, type CardUsage } from '../core/finance';
import type { Card, IsoDate } from '../types/domain';
import { db } from './database';

export interface CardWithUsage {
  card: Card;
  usage: CardUsage;
}

/** Loads everything D11 needs for the given cards in three indexed queries. */
export async function loadCardsWithUsage(
  cards: readonly Card[],
  today: IsoDate,
): Promise<CardWithUsage[]> {
  const ids = cards.map((card) => card.id);
  const [transactions, plans, overrides] = await Promise.all([
    db.transactions.where('cardId').anyOf(ids).toArray(),
    db.installmentPlans.where('cardId').anyOf(ids).toArray(),
    db.balanceOverrides.where('cardId').anyOf(ids).toArray(),
  ]);
  const byCard = <T extends { cardId: string }>(rows: T[], id: string) =>
    rows.filter((row) => row.cardId === id);

  return cards.map((card) => ({
    card,
    usage: computeCardUsage({
      card,
      transactions: byCard(transactions, card.id),
      plans: byCard(plans, card.id),
      overrides: byCard(overrides, card.id),
      today,
    }),
  }));
}
