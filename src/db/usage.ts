import {
  computeCardUsage,
  monthOf,
  projectTotalLiabilities,
  recentActivity,
  spendingInMonth,
  upcomingBill,
  upcomingBills,
  type MonthAmount,
  type BillingInput,
  type Bill,
  type CardUsage,
  type CardUsageInput,
} from '../core/finance';
import type {
  BalanceOverride,
  Card,
  CreditCard,
  CurrencyCode,
  DebitCard,
  InstallmentPlan,
  IsoDate,
  Payment,
  Statement,
  Transaction,
} from '../types/domain';
import { cardsRepo } from './cards';
import { db } from './database';

/**
 * What a card shows at a glance: a limit gauge and the next bill for credit, this
 * month's spending for debit (D13, D14).
 */
export type CardSummary =
  { card: CreditCard; usage: CardUsage; bill: Bill } | { card: DebitCard; monthSpending: number };

/** Everything D11, D12 and D14 need for one credit card. */
export interface CreditCardInput extends CardUsageInput, BillingInput {
  card: CreditCard;
  transactions: Transaction[];
  plans: InstallmentPlan[];
  overrides: BalanceOverride[];
  statements: Statement[];
  payments: Payment[];
}

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
  return (await loadCards(cards, today)).summaries;
}

/** One month per bar in the dashboard's cash-flow chart; the 3/6/12 toggle slices it. */
export const PROJECTION_MONTHS = 12;

export interface DashboardData {
  summaries: CardSummary[];
  /** The next bill of every credit card, earliest due first (D14). */
  bills: { card: CreditCard; bill: Bill }[];
  /** Liabilities per currency for the next 12 due months, from this month (credit only). */
  projections: Record<CurrencyCode, MonthAmount[]>;
  /** Latest entries across credit and debit cards. */
  recent: { transaction: Transaction; card: Card }[];
}

export const RECENT_ACTIVITY_COUNT = 8;

/** Everything the dashboard shows, for the active cards. */
export async function loadDashboard(today: IsoDate): Promise<DashboardData> {
  const cards = await cardsRepo.list();
  const { summaries, creditInputs, debitTransactions } = await loadCards(cards, today);
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const transactions = [
    ...creditInputs.flatMap((input) => input.transactions),
    ...debitTransactions,
  ];

  return {
    summaries,
    bills: upcomingBills(creditInputs, today),
    projections: projectTotalLiabilities(creditInputs, monthOf(today), PROJECTION_MONTHS),
    recent: recentActivity(transactions, RECENT_ACTIVITY_COUNT).map((transaction) => ({
      transaction,
      card: cardById.get(transaction.cardId)!,
    })),
  };
}

async function loadCards(cards: readonly Card[], today: IsoDate) {
  const credit = cards.filter((card): card is CreditCard => card.type === 'credit');
  const debit = cards.filter((card): card is DebitCard => card.type === 'debit');
  const [creditInputs, debitTransactions] = await Promise.all([
    loadUsageInputs(credit, today),
    db.transactions
      .where('cardId')
      .anyOf(debit.map((card) => card.id))
      .toArray(),
  ]);
  const month = monthOf(today);

  // Keep the caller's order (cards come sorted by name).
  const summaries = cards.map((card): CardSummary => {
    if (card.type === 'credit') {
      const input = creditInputs[credit.indexOf(card)]!;
      return { card, usage: computeCardUsage(input), bill: upcomingBill(input, today) };
    }
    return {
      card,
      monthSpending: spendingInMonth(byCard(debitTransactions, card.id), month, card.currency),
    };
  });
  return { summaries, creditInputs, debitTransactions };
}

function byCard<T extends { cardId: string }>(rows: readonly T[], id: string): T[] {
  return rows.filter((row) => row.cardId === id);
}
