import { Dexie } from 'dexie';
import { FinancierDatabase, SCHEMA_V1 } from './database';

/** Creates a database exactly as a Phase 1 (schema v1) install left it. */
async function createV1Database(name: string) {
  const v1 = new Dexie(name);
  v1.version(1).stores(SCHEMA_V1);
  await v1.table('cards').bulkAdd([
    {
      id: 'bonus',
      name: 'Bonus',
      bank: 'Garanti BBVA',
      last4: '4821',
      currency: 'TRY',
      limit: 5_000_000,
      statementDay: 10,
      dueDay: 20,
      color: '#34d399',
      archived: false,
    },
    {
      id: 'old',
      name: 'Old card',
      bank: '',
      last4: '',
      currency: 'TRY',
      limit: 100_000,
      statementDay: 1,
      dueDay: 11,
      color: '#94a3b8',
      archived: true,
    },
  ]);
  await v1.table('transactions').add({
    id: 't1',
    cardId: 'bonus',
    date: '2026-11-01',
    description: 'Laptop',
    normalizedMerchant: 'laptop',
    amount: 1_200_000,
    currency: 'TRY',
    category: 'uncategorized',
    fingerprint: 'bonus|2026-11-01|1200000|laptop',
    source: 'manual',
  });
  v1.close();
}

describe('schema v2 upgrade (D13)', () => {
  const name = 'financier-upgrade-test';
  afterEach(() => Dexie.delete(name));

  it('makes every existing card a credit card and keeps all data', async () => {
    await createV1Database(name);

    const db = new FinancierDatabase(name);
    await db.open();
    expect(db.verno).toBe(2);

    const cards = await db.cards.orderBy('id').toArray();
    expect(cards).toEqual([
      expect.objectContaining({ id: 'bonus', type: 'credit', limit: 5_000_000, statementDay: 10 }),
      expect.objectContaining({ id: 'old', type: 'credit', archived: true }),
    ]);
    expect(await db.transactions.get('t1')).toMatchObject({ cardId: 'bonus', amount: 1_200_000 });
    db.close();
  });

  it('opens a fresh database at v2 with nothing to upgrade', async () => {
    const db = new FinancierDatabase(name);
    await db.open();
    expect(db.verno).toBe(2);
    expect(await db.cards.count()).toBe(0);
    db.close();
  });
});
