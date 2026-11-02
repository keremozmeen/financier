import { Dexie, type EntityTable } from 'dexie';
import type {
  BalanceOverride,
  Card,
  ImportProfile,
  ImportRecord,
  InstallmentPlan,
  SettingRow,
  Statement,
  Subscription,
  Transaction,
} from '../types/domain';

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

  constructor(name = 'financier') {
    super(name);
    // Never edit an existing version; add version(n + 1) with an upgrade instead (D1).
    this.version(1).stores({
      cards: 'id',
      transactions: 'id, cardId, date, fingerprint, installmentPlanId, importId',
      installmentPlans: 'id, cardId',
      statements: 'id, cardId, dueDate',
      subscriptions: 'id, normalizedMerchant, status',
      importProfiles: 'id, headerSignature',
      imports: 'id, importedAt',
      settings: 'key',
      balanceOverrides: 'id, cardId',
    });
  }
}

export const db = new FinancierDatabase();

export function newId(): string {
  return crypto.randomUUID();
}
