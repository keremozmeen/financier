import { Dexie, type EntityTable, type Transaction as DexieTransaction } from 'dexie';
import type {
  BalanceOverride,
  Card,
  ImportProfile,
  ImportRecord,
  InstallmentPlan,
  Payment,
  SettingRow,
  Statement,
  Subscription,
  Transaction,
} from '../types/domain';

/** Version 1 stores, kept as a constant so the upgrade test can create a v1 database. */
export const SCHEMA_V1 = {
  cards: 'id',
  transactions: 'id, cardId, date, fingerprint, installmentPlanId, importId',
  installmentPlans: 'id, cardId',
  statements: 'id, cardId, dueDate',
  subscriptions: 'id, normalizedMerchant, status',
  importProfiles: 'id, headerSignature',
  imports: 'id, importedAt',
  settings: 'key',
  balanceOverrides: 'id, cardId',
};

/** v2 (D13): every card has a type; cards saved before card types existed are credit cards. */
export async function upgradeToV2(tx: DexieTransaction): Promise<void> {
  await tx
    .table('cards')
    .toCollection()
    .modify((card: { type?: string }) => {
      card.type ??= 'credit';
    });
}

export class FinancierDatabase extends Dexie {
  cards!: EntityTable<Card, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  installmentPlans!: EntityTable<InstallmentPlan, 'id'>;
  statements!: EntityTable<Statement, 'id'>;
  subscriptions!: EntityTable<Subscription, 'id'>;
  importProfiles!: EntityTable<ImportProfile, 'id'>;
  imports!: EntityTable<ImportRecord, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;
  balanceOverrides!: EntityTable<BalanceOverride, 'id'>;
  payments!: EntityTable<Payment, 'id'>;

  constructor(name = 'financier') {
    super(name);
    // Never edit an existing version; add version(n + 1) with an upgrade instead (D1).
    this.version(1).stores(SCHEMA_V1);
    this.version(2).stores({ cards: 'id' }).upgrade(upgradeToV2);
    // v3 (D14): bill payments. Nothing to migrate: no statements were stored before.
    this.version(3).stores({ payments: 'id, cardId, statementId' });
  }
}

export const db = new FinancierDatabase();

export function newId(): string {
  return crypto.randomUUID();
}
