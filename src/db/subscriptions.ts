import { buildRadar, detectSeries, type DetectedSeries, type Radar } from '../core/subscriptions';
import type { Card, IsoDate, Subscription } from '../types/domain';
import { cardsRepo } from './cards';
import { db } from './database';

type SeriesRef = Pick<DetectedSeries, 'key' | 'merchant' | 'currency'>;

/** Updates the stored choice for a series, creating it on the first choice (D19). */
async function change(series: SeriesRef, apply: (row: Subscription) => void): Promise<void> {
  await db.transaction('rw', db.subscriptions, async () => {
    const row: Subscription = (await db.subscriptions.get(series.key)) ?? {
      id: series.key,
      normalizedMerchant: series.merchant,
      currency: series.currency,
      status: 'active',
    };
    apply(row);
    await db.subscriptions.put(row);
  });
}

/** The user's Sub-Radar choices (D19). Series themselves are computed, never stored. */
export const subscriptionsRepo = {
  list(): Promise<Subscription[]> {
    return db.subscriptions.toArray();
  },

  /** Hides the series from lists, totals and alerts. */
  ignore(series: SeriesRef) {
    return change(series, (row) => {
      row.status = 'ignored';
    });
  },

  /** Leaves the totals; a charge after `date` raises an alert. */
  cancel(series: SeriesRef, date: IsoDate) {
    return change(series, (row) => {
      row.status = 'cancelled';
      row.cancelledAt = date;
    });
  },

  /** Back to an active subscription (from ignored, cancelled, or "Still active"). */
  restore(series: SeriesRef) {
    return change(series, (row) => {
      row.status = 'active';
      delete row.cancelledAt;
    });
  },

  /** "Got it" on a price increase: quiet until the price goes higher than `amount`. */
  acknowledgeIncrease(series: SeriesRef, amount: number) {
    return change(series, (row) => {
      row.hikeSeenAmount = amount;
    });
  },

  /** "Not a duplicate" on a double charge, by the second charge's transaction id. */
  dismissDouble(series: SeriesRef, transactionId: string) {
    return change(series, (row) => {
      row.dismissedDuplicates = [...new Set([...(row.dismissedDuplicates ?? []), transactionId])];
    });
  },
};

export interface SubRadarData {
  radar: Radar;
  cardById: Map<string, Card>;
  /** When each cancelled series was marked cancelled. */
  cancelledAt: Map<string, IsoDate>;
}

/**
 * Detects subscriptions over every card's entries, credit and debit, archived cards
 * included so a subscription moved to a new card keeps its history (D19).
 */
export async function loadSubRadar(today: IsoDate): Promise<SubRadarData> {
  const [cards, choices] = await Promise.all([
    cardsRepo.list({ includeArchived: true }),
    subscriptionsRepo.list(),
  ]);
  const transactions = await db.transactions
    .where('cardId')
    .anyOf(cards.map((card) => card.id))
    .toArray();
  return {
    radar: buildRadar(detectSeries(transactions, today), choices),
    cardById: new Map(cards.map((card) => [card.id, card])),
    cancelledAt: new Map(
      choices.flatMap((choice) => (choice.cancelledAt ? [[choice.id, choice.cancelledAt]] : [])),
    ),
  };
}
