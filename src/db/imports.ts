import {
  computeBill,
  normalizeDescription,
  statementPeriodFor,
  transactionFingerprint,
} from '../core/finance';
import {
  countOutcomes,
  importChanges,
  planImport,
  type DraftRow,
  type ImportContext,
} from '../core/import';
import type {
  Card,
  ImportOptions,
  ImportProfile,
  ImportRecord,
  IsoDate,
  TransactionSource,
} from '../types/domain';
import { db, newId } from './database';
import { paymentsRepo } from './payments';
import { loadUsageInputs } from './usage';

export interface CommitRequest {
  card: Card;
  fileName: string;
  rows: readonly DraftRow[];
  source: Exclude<TransactionSource, 'manual'>;
  profileId?: string;
  today: IsoDate;
  now?: Date;
}

const IMPORT_TABLES = [
  db.cards,
  db.transactions,
  db.installmentPlans,
  db.balanceOverrides,
  db.statements,
  db.payments,
  db.imports,
];

export const importsRepo = {
  /** Everything stored for a card that an import is checked against (D3, D16). */
  async loadContext(card: Card): Promise<ImportContext> {
    const [transactions, plans, statements, payments, overrides] = await Promise.all([
      db.transactions.where('cardId').equals(card.id).toArray(),
      db.installmentPlans.where('cardId').equals(card.id).toArray(),
      db.statements.where('cardId').equals(card.id).toArray(),
      db.payments.where('cardId').equals(card.id).toArray(),
      db.balanceOverrides.where('cardId').equals(card.id).toArray(),
    ]);
    return { card, transactions, plans, statements, payments, overrides };
  },

  /** Saves the reviewed rows (D16). Returns the new import's id. */
  async commit(request: CommitRequest): Promise<string> {
    const { card, rows, source, today, now = new Date() } = request;
    return db.transaction('rw', IMPORT_TABLES, async () => {
      // Planned again inside the transaction, so dedup sees the data as it is now.
      const planned = planImport(rows, await importsRepo.loadContext(card));
      const changes = importChanges(planned, card, source);
      const importId = newId();
      const restore: ImportRecord['restore'] = { transactions: [], plans: [] };

      await db.transactions.bulkAdd(
        changes.transactions.map((tx) => ({ ...tx, id: newId(), importId })),
      );
      for (const { plan, purchase } of changes.plans) {
        const planId = newId();
        await db.installmentPlans.add({ ...plan, id: planId, importId });
        await db.transactions.add({
          ...purchase,
          id: newId(),
          installmentPlanId: planId,
          importId,
        });
      }

      // "Already logged" entries without a description take the bank's (D3).
      for (const { transactionId, description } of changes.merges) {
        const tx = await db.transactions.get(transactionId);
        if (!tx || tx.description.trim()) continue;
        restore.transactions.push(pick(tx));
        await db.transactions.update(transactionId, described(tx, description));
      }
      // Linked plans without a description take the bank's, and so does their purchase.
      for (const { planId, description } of changes.links) {
        const plan = await db.installmentPlans.get(planId);
        if (!plan || plan.description.trim()) continue;
        restore.plans.push({ id: plan.id, description: plan.description });
        await db.installmentPlans.update(planId, { description });
        const purchases = await db.transactions.where('installmentPlanId').equals(planId).toArray();
        for (const tx of purchases.filter((p) => !p.description.trim())) {
          restore.transactions.push(pick(tx));
          await db.transactions.update(tx.id, described(tx, description));
        }
      }

      // Payments go last so each bill includes the imported charges (D14, D15).
      let payments = 0;
      if (card.type === 'credit') {
        for (const payment of changes.payments) {
          const [input] = await loadUsageInputs([card], today);
          const bill = computeBill(statementPeriodFor(payment.periodEnd, card), input!);
          if (bill.amountDue <= 0) continue;
          await paymentsRepo.record(card, bill, payment.amount, payment.date, { importId, now });
          payments++;
        }
      }

      const counts = countOutcomes(planned);
      await db.imports.add({
        id: importId,
        fileName: request.fileName,
        importedAt: now.toISOString(),
        rowCount: rows.length,
        ...(request.profileId ? { profileId: request.profileId } : {}),
        cardId: card.id,
        counts: {
          transactions: changes.transactions.length,
          plans: changes.plans.length,
          payments,
          merged: counts.merge,
          linked: counts.link,
          skipped:
            counts.skip +
            counts.duplicate +
            counts.paymentRecorded +
            counts.dropped +
            counts.invalid,
        },
        restore,
      });
      return importId;
    });
  },

  /** Newest first. */
  async list(): Promise<ImportRecord[]> {
    return await db.imports.orderBy('importedAt').reverse().toArray();
  },

  /**
   * Undoes a whole import (D16): removes its transactions, the plans and payments it
   * created (re-settling their statements, D14) and restores the descriptions it filled.
   */
  async undo(importId: string): Promise<void> {
    await db.transaction('rw', IMPORT_TABLES, async () => {
      const record = await db.imports.get(importId);
      if (!record) return;
      const payments = await db.payments.where('importId').equals(importId).primaryKeys();
      for (const id of payments) await paymentsRepo.remove(id);
      await db.transactions.where('importId').equals(importId).delete();
      await db.installmentPlans.where('importId').equals(importId).delete();
      for (const { id, ...previous } of record.restore.transactions) {
        await db.transactions.update(id, previous);
      }
      for (const { id, description } of record.restore.plans) {
        await db.installmentPlans.update(id, { description });
      }
      await db.imports.delete(importId);
    });
  },

  /** The saved profile for files with these headers (D3). */
  async findProfile(headerSignature: string): Promise<ImportProfile | undefined> {
    return db.importProfiles.where('headerSignature').equals(headerSignature).first();
  },

  /** Saves the mapping for files with these headers, replacing an earlier one. */
  async saveProfile(profile: {
    name: string;
    headerSignature: string;
    columnMap: Record<string, string>;
    options: ImportOptions;
  }): Promise<string> {
    return db.transaction('rw', db.importProfiles, async () => {
      const existing = await importsRepo.findProfile(profile.headerSignature);
      const id = existing?.id ?? newId();
      await db.importProfiles.put({ ...profile, id, bank: existing?.bank ?? '', kind: 'csv' });
      return id;
    });
  },
};

function pick(tx: {
  id: string;
  description: string;
  normalizedMerchant: string;
  fingerprint: string;
}) {
  return {
    id: tx.id,
    description: tx.description,
    normalizedMerchant: tx.normalizedMerchant,
    fingerprint: tx.fingerprint,
  };
}

function described(tx: { cardId: string; date: IsoDate; amount: number }, description: string) {
  return {
    description,
    normalizedMerchant: normalizeDescription(description),
    fingerprint: transactionFingerprint(tx.cardId, tx.date, tx.amount, description),
  };
}
