import { Dexie } from 'dexie';
import { db, FinancierDatabase, SCHEMA_V1 } from './database';
import { merchantRulesRepo } from './merchantRules';

const NAME = 'financier-v5-upgrade-test';

const ROWS: Record<string, Record<string, unknown>[]> = {
  cards: [
    {
      id: 'c1',
      type: 'credit',
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
      id: 'd1',
      type: 'debit',
      name: 'Vadesiz',
      bank: '',
      last4: '',
      currency: 'TRY',
      color: '#94a3b8',
      archived: false,
    },
  ],
  transactions: [
    {
      id: 't1',
      cardId: 'c1',
      date: '2026-10-01',
      description: 'MİGROS KADIKÖY',
      normalizedMerchant: 'migros kadikoy',
      amount: 123_456,
      currency: 'TRY',
      category: 'uncategorized',
      fingerprint: 'c1|2026-10-01|123456|migros kadikoy',
      source: 'csv',
      importId: 'i1',
    },
    {
      id: 't2',
      cardId: 'c1',
      date: '2026-10-02',
      description: 'MİGROS İADE',
      normalizedMerchant: 'migros iade',
      amount: -5_000,
      currency: 'TRY',
      category: 'uncategorized',
      fingerprint: 'c1|2026-10-02|-5000|migros iade#2',
      source: 'csv',
      importId: 'i1',
    },
    {
      id: 't3',
      cardId: 'c1',
      date: '2026-10-03',
      description: 'Laptop',
      normalizedMerchant: 'laptop',
      amount: 1_200_000,
      currency: 'TRY',
      category: 'uncategorized',
      fingerprint: 'c1|2026-10-03|1200000|laptop',
      source: 'manual',
      installmentPlanId: 'p1',
    },
    {
      id: 't4',
      cardId: 'd1',
      date: '2026-10-04',
      description: 'MAAŞ',
      normalizedMerchant: 'maas',
      amount: -4_000_000,
      currency: 'TRY',
      category: 'uncategorized',
      fingerprint: 'd1|ref|R1',
      source: 'csv',
      income: true,
    },
    {
      id: 't5',
      cardId: 'd1',
      date: '2026-10-05',
      description: 'ENERJISA',
      normalizedMerchant: 'enerjisa',
      amount: 90_000,
      currency: 'TRY',
      category: 'uncategorized',
      fingerprint: 'd1|ref|R2',
      source: 'csv',
      bill: true,
    },
    {
      id: 't6',
      cardId: 'c1',
      date: '2026-10-06',
      description: 'KART ÜCRETİ',
      normalizedMerchant: 'kart ucreti',
      amount: 25_000,
      currency: 'TRY',
      category: 'uncategorized',
      fingerprint: 'c1|2026-10-06|25000|kart ucreti',
      source: 'csv',
      fee: true,
    },
    {
      id: 't7',
      cardId: 'd1',
      date: '2026-10-07',
      description: 'ATM',
      normalizedMerchant: 'atm',
      amount: 100_000,
      currency: 'TRY',
      category: 'uncategorized',
      fingerprint: 'd1|ref|R3',
      source: 'csv',
      transfer: true,
    },
  ],
  installmentPlans: [
    {
      id: 'p1',
      cardId: 'c1',
      description: 'Laptop',
      totalAmount: 1_200_000,
      count: 6,
      purchaseDate: '2026-10-03',
      firstDueMonth: '2026-11',
      currency: 'TRY',
    },
    {
      id: 'p2',
      cardId: 'c1',
      description: 'TV',
      totalAmount: 300_001,
      count: 3,
      purchaseDate: '2026-09-03',
      firstDueMonth: '2026-10',
      currency: 'TRY',
      importId: 'i1',
    },
  ],
  statements: [
    {
      id: 's1',
      cardId: 'c1',
      periodStart: '2026-09-11',
      periodEnd: '2026-10-10',
      dueDate: '2026-10-20',
      totalDue: 123_456,
      paid: true,
      installments: [],
    },
  ],
  payments: [
    {
      id: 'pay1',
      cardId: 'c1',
      statementId: 's1',
      date: '2026-10-19',
      amount: 123_456,
      currency: 'TRY',
      createdAt: '2026-10-19T10:00:00.000Z',
      method: 'manual',
      importId: 'i1',
    },
  ],
  subscriptions: [
    {
      id: 'netflix|TRY',
      normalizedMerchant: 'netflix',
      currency: 'TRY',
      status: 'ignored',
      hikeSeenAmount: 19_999,
      dismissedDuplicates: ['t9'],
    },
  ],
  importProfiles: [
    {
      id: 'ip1',
      name: 'Garanti',
      bank: 'Garanti BBVA',
      kind: 'csv',
      headerSignature: 'a|b',
      columnMap: { date: 'Tarih' },
      options: { headerRow: 2 },
    },
  ],
  imports: [
    {
      id: 'i1',
      fileName: 'ekstre.csv',
      importedAt: '2026-10-08T10:00:00.000Z',
      rowCount: 3,
      cardId: 'c1',
      counts: { saved: 2 },
      restore: [],
    },
  ],
  settings: [{ key: 'locale', value: 'tr' }],
  balanceOverrides: [
    {
      id: 'b1',
      cardId: 'c1',
      balance: -1_000,
      currency: 'TRY',
      asOf: '2026-10-01',
      createdAt: '2026-10-01T10:00:00.000Z',
    },
  ],
};

/** A database exactly as schema v4 left it. */
async function createV4Database() {
  const v4 = new Dexie(NAME);
  v4.version(1).stores(SCHEMA_V1);
  v4.version(2).stores({ cards: 'id' });
  v4.version(3).stores({ payments: 'id, cardId, statementId' });
  v4.version(4).stores({
    payments: 'id, cardId, statementId, importId',
    installmentPlans: 'id, cardId, importId',
    imports: 'id, importedAt, cardId',
  });
  await v4.open();
  for (const [table, rows] of Object.entries(ROWS)) await v4.table(table).bulkAdd(rows);
  const stored = await dump(v4);
  v4.close();
  return stored;
}

/** Every row of every v4 table, serialized in key order. */
async function dump(database: Dexie): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const table of Object.keys(ROWS)) {
    const rows = await database
      .table(table)
      .toCollection()
      .sortBy(table === 'settings' ? 'key' : 'id');
    out[table] = rows.map((row) => JSON.stringify(row));
  }
  return out;
}

describe('schema v5 upgrade (D22)', () => {
  afterEach(() => Dexie.delete(NAME));

  it('leaves every pre-existing row byte-for-byte unchanged', async () => {
    const before = await createV4Database();
    expect(before.transactions).toHaveLength(7);

    const upgraded = new FinancierDatabase(NAME);
    await upgraded.open();
    expect(upgraded.verno).toBe(5);

    expect(await dump(upgraded)).toEqual(before);
    upgraded.close();
  });

  it('keeps the indexes existing tables had and adds an empty rules table', async () => {
    await createV4Database();
    const upgraded = new FinancierDatabase(NAME);
    await upgraded.open();

    expect(await upgraded.merchantRules.count()).toBe(0);
    expect(await upgraded.transactions.where('fingerprint').equals('d1|ref|R1').count()).toBe(1);
    expect(await upgraded.payments.where('importId').equals('i1').count()).toBe(1);
    expect(await upgraded.installmentPlans.where('importId').equals('i1').count()).toBe(1);
    upgraded.close();
  });
});

describe('merchantRulesRepo (D22)', () => {
  beforeEach(() => db.merchantRules.clear());

  it('stores, replaces and removes a rule', async () => {
    await merchantRulesRepo.set('migros', 'shopping');
    await merchantRulesRepo.set('migros', 'groceries/fresh');
    expect(await merchantRulesRepo.list()).toEqual([
      { id: 'migros', category: 'groceries/fresh', createdAt: expect.any(String) },
    ]);
    await merchantRulesRepo.remove('migros');
    expect(await merchantRulesRepo.list()).toEqual([]);
  });

  it('refuses a rule without a merchant', async () => {
    await expect(merchantRulesRepo.set('', 'shopping')).rejects.toThrow(RangeError);
  });
});
