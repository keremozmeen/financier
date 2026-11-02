import {
  computeCardUsage,
  monthOf,
  spendingInMonth,
  upcomingBill,
  type BillingInput,
  type Bill,
  type CardUsage,
  type CardUsageInput,
} from '../core/finance';
import type { Card, CreditCard, DebitCard, IsoDate } from '../types/domain';
import { db } from './database';

/**
 * What a card shows at a glance: a limit gauge and the next bill for credit, this
 * month's spending for debit (D13, D14).
 */
export type CardSummary =
  { card: CreditCard; usage: CardUsage; bill: Bill } | { card: DebitCard; monthSpending: number };

/** Everything D11, D12 and D14 need for one credit card. */
export type CreditCardInput = CardUsageInput & BillingInput & { card: CreditCard };

/** Loads the usage and billing inputs for the given credit cards in five indexed queries. */
export async function loadUsageInputs(
  cards: readonly CreditCard[],
  today: IsoDate,
): Promise<CreditCardInput[]> {
  const ids = cards.map((card) => card.id);
  const [transactions, plans, overrides, statements, payments] = await Promise.all([
    db.transactions.where('cardId').anyOf(ids).toArray(),
    db.installmentPlans.where('cardId').anyOf(ids).toArray(),
    db.balanceOverrides.where('cardId').anyOf(ids).toArray(),
    db.statements.where('cardId').anyOf(ids).toArray(),
    db.payments.where('cardId').anyOf(ids).toArray(),
  ]);
  return cards.map((card) => ({
    card,
    transactions: byCard(transactions, card.id),
    plans: byCard(plans, card.id),
    overrides: byCard(overrides, card.id),
    statements: byCard(statements, card.id),
    payments: byCard(payments, card.id),
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
      const input = usageInputs[credit.indexOf(card)]!;
      return { card, usage: computeCardUsage(input), bill: upcomingBill(input, today) };
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
