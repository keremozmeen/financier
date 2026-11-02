import { balanceOverridesRepo, cardsRepo, loadCardsWithUsage, transactionsRepo } from '.';
import type { CardInput } from './cards';
import { db } from './database';

const cardInput: CardInput = {
  name: 'Bonus',
  bank: 'Garanti BBVA',
  last4: '1234',
  currency: 'TRY',
  limit: 5_000_000,
  statementDay: 10,
  dueDay: 20,
  color: '#34d399',
};

async function createCard(overrides: Partial<CardInput> = {}) {
  const id = await cardsRepo.create({ ...cardInput, ...overrides });
  const card = await cardsRepo.get(id);
  if (!card) throw new Error('card not saved');
  return card;
}

describe('cardsRepo', () => {
  it('creates, updates and lists active cards by name', async () => {
    const b = await createCard({ name: 'World' });
    await createCard({ name: 'Axess' });
    await cardsRepo.update(b.id, { limit: 100 });

    const cards = await cardsRepo.list();
    expect(cards.map((c) => c.name)).toEqual(['Axess', 'World']);
    expect(cards[1]).toMatchObject({ limit: 100, archived: false });
  });

  it('hides archived cards unless asked and keeps their data', async () => {
    const card = await createCard();
    await transactionsRepo.addManual({
      card,
      date: '2026-11-01',
      description: 'Market',
      amount: 1000,
      kind: 'charge',
      installments: 1,
    });
    await cardsRepo.setArchived(card.id, true);

    expect(await cardsRepo.list()).toEqual([]);
    expect(await cardsRepo.list({ includeArchived: true })).toHaveLength(1);
    expect(await transactionsRepo.listByCard(card.id)).toHaveLength(1);
  });

  it('deletes a card with all of its records', async () => {
    const card = await createCard();
    const other = await createCard({ name: 'Other' });
    for (const c of [card, other]) {
      await transactionsRepo.addManual({
        card: c,
        date: '2026-11-01',
        description: 'Laptop',
        amount: 1_200_000,
        kind: 'charge',
        installments: 6,
      });
      await balanceOverridesRepo.add(c, 100, '2026-10-01');
    }
    expect(await cardsRepo.countRecords(card.id)).toEqual({ transactions: 1, overrides: 1 });

    await cardsRepo.deletePermanently(card.id);

    expect(await cardsRepo.get(card.id)).toBeUndefined();
    expect(await db.transactions.where('cardId').equals(card.id).count()).toBe(0);
    expect(await db.installmentPlans.where('cardId').equals(card.id).count()).toBe(0);
    expect(await db.balanceOverrides.where('cardId').equals(card.id).count()).toBe(0);
    expect(await cardsRepo.countRecords(other.id)).toEqual({ transactions: 1, overrides: 1 });
  });
});

describe('transactionsRepo', () => {
  it('stores a single charge with fingerprint and normalized merchant', async () => {
    const card = await createCard();
    const id = await transactionsRepo.addManual({
      card,
      date: '2026-11-02',
      description: '  MİGROS Kadıköy ',
      amount: 45_000,
      kind: 'charge',
      installments: 1,
    });
    expect(await db.transactions.get(id)).toMatchObject({
      description: 'MİGROS Kadıköy',
      normalizedMerchant: 'migros kadikoy',
      amount: 45_000,
      currency: 'TRY',
      source: 'manual',
      fingerprint: `${card.id}|2026-11-02|45000|migros kadikoy`,
    });
  });

  it('stores refunds as negative amounts', async () => {
    const card = await createCard();
    const id = await transactionsRepo.addManual({
      card,
      date: '2026-11-02',
      description: 'Return',
      amount: 5_000,
      kind: 'refund',
      installments: 1,
    });
    expect((await db.transactions.get(id))?.amount).toBe(-5_000);
  });

  it('saves identical manual entries without deduplicating them (D3)', async () => {
    const card = await createCard();
    const dinner = {
      card,
      date: '2026-11-02',
      description: '',
      amount: 85_000,
      kind: 'charge',
      installments: 1,
    } as const;
    const first = await transactionsRepo.addManual(dinner);
    const second = await transactionsRepo.addManual(dinner);

    expect(first).not.toBe(second);
    const saved = await transactionsRepo.listByCard(card.id);
    expect(saved).toHaveLength(2);
    // Same fingerprint: dedup by fingerprint is for imports only.
    expect(saved[0]?.fingerprint).toBe(saved[1]?.fingerprint);
    expect(saved[0]).toMatchObject({ description: '', normalizedMerchant: '' });
  });

  it('stores an installment purchase as a plan plus a linked transaction', async () => {
    const card = await createCard();
    const id = await transactionsRepo.addManual({
      card,
      date: '2026-11-15',
      description: 'Phone',
      amount: 1_200_000,
      kind: 'charge',
      installments: 6,
    });
    const [plan] = await transactionsRepo.listPlansByCard(card.id);
    expect(plan).toMatchObject({
      totalAmount: 1_200_000,
      count: 6,
      purchaseDate: '2026-11-15',
      firstDueMonth: '2026-12',
    });
    expect((await db.transactions.get(id))?.installmentPlanId).toBe(plan?.id);
  });

  it('rejects refunds in installments and invalid amounts', async () => {
    const card = await createCard();
    const base = { card, date: '2026-11-02', description: 'x', installments: 1 } as const;
    await expect(
      transactionsRepo.addManual({ ...base, amount: 100, kind: 'refund', installments: 3 }),
    ).rejects.toThrow(RangeError);
    await expect(
      transactionsRepo.addManual({ ...base, amount: 0, kind: 'charge' }),
    ).rejects.toThrow(RangeError);
  });

  it('removes an installment purchase together with its plan', async () => {
    const card = await createCard();
    const id = await transactionsRepo.addManual({
      card,
      date: '2026-11-15',
      description: 'Phone',
      amount: 1_200_000,
      kind: 'charge',
      installments: 6,
    });
    await transactionsRepo.remove(id);
    expect(await transactionsRepo.listByCard(card.id)).toEqual([]);
    expect(await transactionsRepo.listPlansByCard(card.id)).toEqual([]);
  });
});

describe('balanceOverridesRepo', () => {
  it('keeps history with the newest entry first', async () => {
    const card = await createCard();
    await balanceOverridesRepo.add(card, 750_000, '2026-10-20', new Date('2026-10-20T10:00:00Z'));
    await balanceOverridesRepo.add(card, 0, '2026-11-01', new Date('2026-11-01T10:00:00Z'));
    const history = await balanceOverridesRepo.listByCard(card.id);
    expect(history.map((o) => o.balance)).toEqual([0, 750_000]);
  });

  it('rejects negative balances', async () => {
    const card = await createCard();
    await expect(balanceOverridesRepo.add(card, -1, '2026-11-01')).rejects.toThrow(RangeError);
  });
});

describe('loadCardsWithUsage', () => {
  it('computes D11 usage per card from the database', async () => {
    const card = await createCard();
    const other = await createCard({ name: 'Other' });
    await transactionsRepo.addManual({
      card,
      date: '2026-11-01',
      description: 'Laptop',
      amount: 1_200_000,
      kind: 'charge',
      installments: 6,
    });
    await transactionsRepo.addManual({
      card,
      date: '2026-11-01',
      description: 'Coffee',
      amount: 15_000,
      kind: 'charge',
      installments: 1,
    });

    const [first, second] = await loadCardsWithUsage([card, other], '2026-11-02');
    expect(first?.usage).toMatchObject({ used: 1_215_000, available: 3_785_000 });
    expect(second?.usage).toMatchObject({ used: 0, available: 5_000_000 });
  });
});
