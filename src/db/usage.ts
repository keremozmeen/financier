import {
  computeCardUsage,
  monthOf,
  spendingInMonth,
  type CardUsage,
  type CardUsageInput,
} from '../core/finance';
import type { Card, CreditCard, DebitCard, IsoDate } from '../types/domain';
import { db } from './database';

/** What a card shows at a glance: a limit gauge for credit, this month's spending for debit (D13). */
export type CardSummary =
  { card: CreditCard; usage: CardUsage } | { card: DebitCard; monthSpending: number };

/** Loads everything D11/D12 need for the given credit cards in three indexed queries. */
export async function loadUsageInputs(
  cards: readonly CreditCard[],
  today: IsoDate,
): Promise<CardUsageInput[]> {
  const ids = cards.map((card) => card.id);
  const [transactions, plans, overrides] = await Promise.all([
    db.transactions.where('cardId').anyOf(ids).toArray(),
    db.installmentPlans.where('cardId').anyOf(ids).toArray(),
    db.balanceOverrides.where('cardId').anyOf(ids).toArray(),
  ]);
  return cards.map((card) => ({
    card,
    transactions: byCard(transactions, card.id),
    plans: byCard(plans, card.id),
    overrides: byCard(overrides, card.id),
    today,
  }));
}

export async function loadCardSummaries(
  cards: readonly Card[],
  today: IsoDate,
): Promise<CardSummary[]> {
  const credit = cards.filter((card): card is CreditCard => card.type === 'credit');
  const debit = cards.filter((card): card is DebitCard => card.type === 'debit');
  const [usageInputs, debitTransactions] = await Promise.all([
    loadUsageInputs(credit, today),
    db.transactions
      .where('cardId')
      .anyOf(debit.map((card) => card.id))
      .toArray(),
  ]);
  const month = monthOf(today);

  // Keep the caller's order (cards come sorted by name).
  return cards.map((card): CardSummary => {
    if (card.type === 'credit') {
      return { card, usage: computeCardUsage(usageInputs[credit.indexOf(card)]!) };
    }
    return {
      card,
      monthSpending: spendingInMonth(byCard(debitTransactions, card.id), month, card.currency),
    };
  });
}

function byCard<T extends { cardId: string }>(rows: readonly T[], id: string): T[] {
  return rows.filter((row) => row.cardId === id);
}
