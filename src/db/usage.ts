import { computeCardUsage, type CardUsage, type CardUsageInput } from '../core/finance';
import type { Card, IsoDate } from '../types/domain';
import { db } from './database';

export interface CardWithUsage {
  card: Card;
  usage: CardUsage;
}

/** Loads everything D11/D12 need for the given cards in three indexed queries. */
export async function loadUsageInputs(
  cards: readonly Card[],
  today: IsoDate,
): Promise<CardUsageInput[]> {
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
    transactions: byCard(transactions, card.id),
    plans: byCard(plans, card.id),
    overrides: byCard(overrides, card.id),
    today,
  }));
}

export async function loadCardsWithUsage(
  cards: readonly Card[],
  today: IsoDate,
): Promise<CardWithUsage[]> {
  const inputs = await loadUsageInputs(cards, today);
  return cards.map((card, index) => ({ card, usage: computeCardUsage(inputs[index]!) }));
}
