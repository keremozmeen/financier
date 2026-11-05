import { computeBill, spendingInMonth, statementPeriodFor } from '../core/finance';
import { draftRows, type DraftRow } from '../core/import';
import { detectHeaderRow, extractRows, guessMapping, guessOptions } from '../parsers/csv';
import { accountFile } from '../parsers/sheet/fixtures';
import { readSpreadsheet, sniffSheetFormat } from '../parsers/sheet';
import type { CreditCard, DebitCard } from '../types/domain';
import { cardsRepo } from './cards';
import { db } from './database';
import { importsRepo } from './imports';
import { paymentsRepo } from './payments';
import { transactionsRepo } from './transactions';
import { billingInput, loadUsageInputs } from './usage';

const TODAY = '2026-10-31';

async function setup({ autoPay = false } = {}) {
  const debitId = await cardsRepo.create({
    type: 'debit',
    name: 'İş Bankası',
    bank: 'İş Bankası',
    last4: '4321',
    currency: 'TRY',
    color: '#000',
  });
  // Statement closes on the 30th and is due on the 10th: the 10 Oct payment pays the
  // statement of September (due Mon 12 Oct, since 10 Oct is a Saturday).
  const creditId = await cardsRepo.create({
    type: 'credit',
    name: 'Maximum',
    bank: 'İş Bankası',
    last4: '1234',
    currency: 'TRY',
    color: '#000',
    limit: 10_000_000,
    statementDay: 30,
    dueDay: 10,
    ...(autoPay ? { autoPay: true, autoPaySince: '2026-09-01' } : {}),
  });
  const credit = (await cardsRepo.get(creditId)) as CreditCard;
  await transactionsRepo.addManual({
    card: credit,
    date: '2026-09-15',
    description: 'Teknosa',
    amount: 425_000,
    kind: 'charge',
    installments: 1,
  });
  return { debit: (await cardsRepo.get(debitId)) as DebitCard, credit };
}

async function rowsFrom(format: 'xls' | 'xlsx' | 'html', card: DebitCard): Promise<DraftRow[]> {
  const bytes = accountFile(format);
  const rows = await readSpreadsheet(bytes, sniffSheetFormat(bytes)!);
  const headerRow = detectHeaderRow(rows);
  const mapping = guessMapping(rows[headerRow]!, rows.slice(headerRow + 1));
  const options = guessOptions(rows, headerRow, mapping);
  return draftRows(extractRows(rows, mapping, options, card.currency), card.type, 'account');
}

const commit = (card: DebitCard, rows: DraftRow[], fileName = 'hesap.xls') =>
  importsRepo.commit({ card, rows, fileName, source: 'csv', today: TODAY });

describe.each(['xls', 'xlsx', 'html'] as const)(
  'account statement import from %s (D17)',
  (format) => {
    it('imports each row type onto the debit card and pays the credit card', async () => {
      const { debit, credit } = await setup();
      const importId = await commit(debit, await rowsFrom(format, debit));

      const saved = await transactionsRepo.listByCard(debit.id);
      const kind = (description: string) => saved.find((t) => t.description === description);
      expect(kind('ACME A.Ş. EKİM MAAŞ')).toMatchObject({ amount: -4_500_000, income: true });
      expect(kind('AYŞE YILMAZ')).toMatchObject({ amount: -250_000, income: true });
      expect(kind('MIGROS KADIKOY')).toMatchObject({ amount: 123_456 });
      expect(kind('ENERJİSA ELEKTRİK FATURASI')).toMatchObject({ amount: 48_990, bill: true });
      expect(kind('ZARA IADE')).toMatchObject({ amount: -29_990 });
      expect(kind('HESAP İŞLETİM ÜCRETİ')).toMatchObject({ amount: 1_250, fee: true });
      // Skipped: the ATM withdrawal and the outgoing EFT; the card payment is not spending.
      expect(kind('ATM KADIKOY')).toBeUndefined();
      expect(kind('MEHMET DEMİR KİRA')).toBeUndefined();
      expect(kind('KREDİ KARTI ÖDEMESİ 5555********1234')).toBeUndefined();
      expect(saved).toHaveLength(7);

      // Spending: Migros + Netflix + bill + fee − refund; income never counts.
      expect(spendingInMonth(saved, '2026-10', 'TRY')).toBe(
        123_456 + 22_999 + 48_990 + 1_250 - 29_990,
      );

      // The payment settled the credit card's September statement.
      const [payment] = await db.payments.where('importId').equals(importId).toArray();
      expect(payment).toMatchObject({ cardId: credit.id, amount: 425_000, date: '2026-10-10' });
      expect(await db.statements.get(payment!.statementId)).toMatchObject({
        periodEnd: '2026-09-30',
        paid: true,
      });
      const [record] = await importsRepo.list();
      expect(record?.counts).toMatchObject({ transactions: 7, payments: 1, skipped: 2 });
    });

    it('adds nothing when the same file is imported again', async () => {
      const { debit } = await setup();
      await commit(debit, await rowsFrom(format, debit));
      await commit(debit, await rowsFrom(format, debit));
      expect(await db.transactions.where('cardId').equals(debit.id).count()).toBe(7);
      expect(await db.payments.count()).toBe(1);
    });
  },
);

describe('account statement dedup (D17)', () => {
  it('matches rows by Referans across formats and changed descriptions', async () => {
    const { debit } = await setup();
    await commit(debit, await rowsFrom('xls', debit));
    const renamed = (await rowsFrom('html', debit)).map((row) => ({
      ...row,
      description: `${row.description} *`,
    }));
    await commit(debit, renamed);
    expect(await db.transactions.where('cardId').equals(debit.id).count()).toBe(7);
  });

  it('does not record a payment auto-pay already made', async () => {
    const { debit } = await setup({ autoPay: true });
    expect(await paymentsRepo.applyAutoPayments(TODAY)).toBe(1);
    await commit(debit, await rowsFrom('xlsx', debit));
    expect((await db.payments.toArray()).map((p) => p.method)).toEqual(['automatic']);
  });

  it('does not record a payment already entered by hand', async () => {
    const { debit, credit } = await setup();
    const input = billingInput((await loadUsageInputs([credit], TODAY))[0]!)!;
    const bill = computeBill(statementPeriodFor('2026-09-30', input.card), input);
    await paymentsRepo.record(credit, bill, 425_000, '2026-10-08');
    await commit(debit, await rowsFrom('xlsx', debit));
    expect(await db.payments.count()).toBe(1);
  });

  it('undo removes the payment from the credit card too', async () => {
    const { debit } = await setup();
    const importId = await commit(debit, await rowsFrom('xlsx', debit));
    await importsRepo.undo(importId);
    expect(await db.transactions.where('cardId').equals(debit.id).count()).toBe(0);
    expect(await db.payments.count()).toBe(0);
    expect(await db.statements.count()).toBe(0);
  });

  it('counts a transfer as spending when the user asks', async () => {
    const { debit } = await setup();
    const rows = (await rowsFrom('xlsx', debit)).map((row) =>
      row.description === 'ATM KADIKOY' ? { ...row, countAsSpending: true } : row,
    );
    await commit(debit, rows);
    expect(
      (await transactionsRepo.listByCard(debit.id)).find((t) => t.description === 'ATM KADIKOY'),
    ).toMatchObject({ amount: 200_000, transfer: true });
  });
});
