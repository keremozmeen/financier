import { cardsRepo, loadSubRadar, subscriptionsRepo } from '.';
import { transactionFingerprint } from '../core/finance';
import type { Card } from '../types/domain';
import { db, newId } from './database';

const TODAY = '2026-10-20';

async function createCards() {
  const credit = await cardsRepo.create({
    type: 'credit',
    name: 'Bonus',
    bank: 'Garanti BBVA',
    last4: '0001',
    currency: 'TRY',
    limit: 5_000_000,
    statementDay: 10,
    dueDay: 20,
    color: '#34d399',
  });
  const debit = await cardsRepo.create({
    type: 'debit',
    name: 'Maaş',
    bank: 'İş Bankası',
    last4: '0002',
    currency: 'TRY',
    color: '#38bdf8',
  });
  return { credit: (await cardsRepo.get(credit))!, debit: (await cardsRepo.get(debit))! };
}

async function charge(card: Card, date: string, description: string, amount: number) {
  const id = newId();
  await db.transactions.add({
    id,
    cardId: card.id,
    date,
    description,
    normalizedMerchant: description.toLowerCase(),
    amount,
    currency: 'TRY',
    category: 'uncategorized',
    fingerprint: transactionFingerprint(card.id, date, amount, description),
    source: 'csv',
  });
  return id;
}

async function netflix(cards: { credit: Card; debit: Card }, last = 22_999) {
  await charge(cards.credit, '2026-08-15', 'NETFLIX.COM', 22_999);
  await charge(cards.debit, '2026-09-15', 'NETFLIX.COM', 22_999);
  await charge(cards.debit, '2026-10-15', 'NETFLIX COM ISTANBUL', last);
}

const series = async () => (await loadSubRadar(TODAY)).radar;

describe('subscriptionsRepo and loadSubRadar (D19)', () => {
  it('detects a subscription across credit and debit cards, archived ones included', async () => {
    const cards = await createCards();
    await netflix(cards);
    await cardsRepo.setArchived(cards.credit.id, true);

    const { radar, cardById } = await loadSubRadar(TODAY);
    expect(radar.subscriptions).toHaveLength(1);
    expect(radar.subscriptions[0]).toMatchObject({
      key: 'netflix|TRY',
      name: 'Netflix',
      state: 'active',
    });
    expect(cardById.get(radar.subscriptions[0]!.latest.cardId)?.name).toBe('Maaş');
  });

  it('ignores, cancels and restores a series', async () => {
    const cards = await createCards();
    await netflix(cards);
    const item = (await series()).subscriptions[0]!;

    await subscriptionsRepo.ignore(item);
    expect((await series()).ignored).toHaveLength(1);

    await subscriptionsRepo.cancel(item, '2026-10-16');
    const cancelled = await series();
    expect(cancelled.cancelled).toHaveLength(1);
    expect(cancelled.alerts).toEqual([]);

    await subscriptionsRepo.restore(item);
    expect((await series()).subscriptions[0]?.state).toBe('active');
    expect(await db.subscriptions.get('netflix|TRY')).not.toHaveProperty('cancelledAt');
  });

  it('alerts on a charge after cancelling, and "Dismiss" moves the date', async () => {
    const cards = await createCards();
    await netflix(cards);
    const item = (await series()).subscriptions[0]!;
    await subscriptionsRepo.cancel(item, '2026-10-01');

    const alert = (await series()).alerts[0];
    expect(alert).toMatchObject({ kind: 'afterCancel', charge: { date: '2026-10-15' } });

    await subscriptionsRepo.cancel(item, '2026-10-15');
    expect((await series()).alerts).toEqual([]);
  });

  it('keeps a price increase quiet once acknowledged, until it goes higher', async () => {
    const cards = await createCards();
    await netflix(cards, 23_999);
    const item = (await series()).subscriptions[0]!;
    expect((await series()).alerts).toMatchObject([{ kind: 'increase' }]);

    await subscriptionsRepo.acknowledgeIncrease(item, 23_999);
    expect((await series()).alerts).toEqual([]);

    await charge(cards.debit, '2026-11-15', 'NETFLIX.COM', 24_999);
    const later = (await loadSubRadar('2026-11-20')).radar;
    expect(later.alerts).toMatchObject([{ kind: 'increase', increase: { to: 24_999 } }]);
  });

  it('dismisses a double charge without touching the others', async () => {
    const cards = await createCards();
    await netflix(cards);
    const double = await charge(cards.debit, '2026-10-16', 'NETFLIX.COM', 22_999);
    const item = (await series()).subscriptions[0]!;
    expect((await series()).alerts).toMatchObject([{ kind: 'double' }]);

    await subscriptionsRepo.dismissDouble(item, double);
    await subscriptionsRepo.dismissDouble(item, double);
    expect((await series()).alerts).toEqual([]);
    expect((await db.subscriptions.get(item.key))?.dismissedDuplicates).toEqual([double]);
  });
});
