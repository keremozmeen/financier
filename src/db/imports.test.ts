import { draftRows, type DraftRow } from '../core/import';
import { extractRows, guessMapping, guessOptions, detectHeaderRow, parseCsv } from '../parsers/csv';
import { CREDIT_CARD_CSV, DEBIT_CARD_CSV } from '../parsers/csv/fixtures';
import type { Card, CreditCard, DebitCard } from '../types/domain';
import { cardsRepo, type CardInput } from './cards';
import { db } from './database';
import { importsRepo } from './imports';
import { paymentsRepo } from './payments';
import { transactionsRepo } from './transactions';
import { billingInput, loadUsageInputs } from './usage';
import { computeCardUsage } from '../core/finance';

const TODAY = '2026-10-15';

async function createCredit(patch: Partial<CreditCard> = {}) {
  const input: CardInput = {
    type: 'credit',
    name: 'Bonus',
    bank: '',
    last4: '',
    currency: 'TRY',
    color: '#000',
    limit: 10_000_000,
    statementDay: 10,
    dueDay: 20,
    ...patch,
  } as CardInput;
  return (await cardsRepo.get(await cardsRepo.create(input))) as CreditCard;
}

async function createDebit() {
  const id = await cardsRepo.create({
    type: 'debit',
    name: 'Maaş',
    bank: '',
    last4: '',
    currency: 'TRY',
    color: '#000',
  });
  return (await cardsRepo.get(id)) as DebitCard;
}

/** The CSV pipeline the import screen runs, with the guessed mapping. */
function rowsFrom(csv: string, card: Card): DraftRow[] {
  const rows = parseCsv(csv);
  const headerRow = detectHeaderRow(rows);
  const mapping = guessMapping(rows[headerRow]!, rows.slice(headerRow + 1));
  const options = guessOptions(rows, headerRow, mapping);
  return draftRows(extractRows(rows, mapping, options, card.currency), card.type);
}

const commit = (card: Card, rows: DraftRow[], fileName = 'ekstre.csv') =>
  importsRepo.commit({ card, rows, fileName, source: 'csv', today: TODAY });

async function seedAugustCharge(card: CreditCard, description = 'Market') {
  // Billed on the statement 11 Aug – 10 Sep, which the 16 Sep payment pays.
  await transactionsRepo.addManual({
    card,
    date: '2026-08-20',
    description,
    amount: 425_000,
    kind: 'charge',
    installments: 1,
  });
}

describe('importsRepo (D16)', () => {
  it('imports each row type from a credit card statement', async () => {
    const card = await createCredit();
    await seedAugustCharge(card);
    const importId = await commit(card, rowsFrom(CREDIT_CARD_CSV, card));

    const imported = await db.transactions.where('importId').equals(importId).toArray();
    expect(imported.map((t) => [t.description, t.amount, t.fee ?? false]).sort()).toEqual(
      [
        ['BSMV', 1240, true],
        ['MIGROS KADIKOY', 123_456, false],
        ['NETFLIX.COM', 22_999, false],
        ['TEKNOSA ISTANBUL TAKSİT 3/6', 200_000, false],
        ['ZARA IADE', -29_990, false],
      ].sort(),
    );

    // The slice created a plan for the four remaining installments, due from October.
    const [plan] = await db.installmentPlans.where('importId').equals(importId).toArray();
    expect(plan).toMatchObject({ count: 4, totalAmount: 200_000, firstDueMonth: '2026-10' });
    expect(imported.find((t) => t.installmentPlanId === plan!.id)?.amount).toBe(200_000);

    // The payment settled the August statement, never a refund.
    const [payment] = await db.payments.where('importId').equals(importId).toArray();
    expect(payment).toMatchObject({ amount: 425_000, date: '2026-09-16', method: 'manual' });
    expect(await db.statements.get(payment!.statementId)).toMatchObject({
      periodEnd: '2026-09-10',
      paid: true,
    });

    const [record] = await importsRepo.list();
    expect(record).toMatchObject({
      id: importId,
      fileName: 'ekstre.csv',
      cardId: card.id,
      rowCount: 8,
      counts: { transactions: 4, plans: 1, payments: 1, merged: 0, linked: 0, skipped: 2 },
    });
  });

  it('adds nothing when the same file is imported again', async () => {
    const card = await createCredit();
    await seedAugustCharge(card);
    await commit(card, rowsFrom(CREDIT_CARD_CSV, card));
    const before = {
      transactions: await db.transactions.count(),
      plans: await db.installmentPlans.count(),
      payments: await db.payments.count(),
    };

    await commit(card, rowsFrom(CREDIT_CARD_CSV, card));
    expect({
      transactions: await db.transactions.count(),
      plans: await db.installmentPlans.count(),
      payments: await db.payments.count(),
    }).toEqual(before);
    const [second] = await importsRepo.list();
    expect(second?.counts).toMatchObject({ transactions: 0, plans: 0, payments: 0, linked: 1 });
  });

  it('merges a charge with a manual entry and fills its description, and undo restores it', async () => {
    const card = await createCredit();
    const manualId = await transactionsRepo.addManual({
      card,
      date: '2026-09-14',
      description: '',
      amount: 123_456,
      kind: 'charge',
      installments: 1,
    });
    const before = await db.transactions.get(manualId);
    const importId = await commit(card, rowsFrom(CREDIT_CARD_CSV, card));

    expect(await db.transactions.get(manualId)).toMatchObject({
      description: 'MIGROS KADIKOY',
      normalizedMerchant: 'migros kadikoy',
      source: 'manual',
    });
    const migros = (await transactionsRepo.listByCard(card.id)).filter((t) => t.amount === 123_456);
    expect(migros).toHaveLength(1);

    await importsRepo.undo(importId);
    expect(await db.transactions.get(manualId)).toEqual(before);
  });

  it('links a slice to a manual installment plan without a description', async () => {
    const card = await createCredit();
    // 3.000 ₺ in 6 installments bought in July: 500 ₺ a month from August.
    await transactionsRepo.addManual({
      card,
      date: '2026-07-15',
      description: '',
      amount: 300_000,
      kind: 'charge',
      installments: 6,
    });
    const [plan] = await db.installmentPlans.toArray();
    const importId = await commit(card, rowsFrom(CREDIT_CARD_CSV, card));

    expect(await db.installmentPlans.count()).toBe(1);
    expect(await db.installmentPlans.get(plan!.id)).toMatchObject({
      description: 'TEKNOSA ISTANBUL TAKSİT 3/6',
    });
    expect(
      (await db.transactions.where('installmentPlanId').equals(plan!.id).toArray()).map(
        (t) => t.description,
      ),
    ).toEqual(['TEKNOSA ISTANBUL TAKSİT 3/6']);

    await importsRepo.undo(importId);
    expect((await db.installmentPlans.get(plan!.id))?.description).toBe('');
    expect(
      (await db.transactions.where('installmentPlanId').equals(plan!.id).first())?.description,
    ).toBe('');
  });

  it('skips a payment already recorded by hand', async () => {
    const card = await createCredit();
    await seedAugustCharge(card);
    const input = billingInput((await loadUsageInputs([card], TODAY))[0]!)!;
    const { computeBill, statementPeriodFor } = await import('../core/finance');
    const bill = computeBill(statementPeriodFor('2026-09-10', input.card), input);
    await paymentsRepo.record(card, bill, 425_000, '2026-09-18');

    await commit(card, rowsFrom(CREDIT_CARD_CSV, card));
    expect(await db.payments.count()).toBe(1);
  });

  it('skips a payment auto-pay already recorded', async () => {
    const card = await createCredit({ autoPay: true, autoPaySince: '2026-09-01' });
    await seedAugustCharge(card);
    expect(await paymentsRepo.applyAutoPayments(TODAY)).toBe(1);
    const rows = rowsFrom(CREDIT_CARD_CSV, card).map((row) =>
      row.type === 'payment' ? { ...row, description: 'OTOMATİK ÖDEME', date: '2026-09-21' } : row,
    );

    await commit(card, rows);
    expect((await db.payments.toArray()).map((p) => p.method)).toEqual(['automatic']);
  });

  it('imports a debit card file: no plans, no payments, identical rows kept', async () => {
    const card = await createDebit();
    const importId = await commit(card, rowsFrom(DEBIT_CARD_CSV, card));

    const imported = await db.transactions.where('importId').equals(importId).toArray();
    expect(imported.map((t) => t.amount).sort((a, b) => a - b)).toEqual([-150_000, 9500, 9500]);
    expect(await db.installmentPlans.count()).toBe(0);
    expect(await db.payments.count()).toBe(0);

    await commit(card, rowsFrom(DEBIT_CARD_CSV, card));
    expect(await db.transactions.count()).toBe(3);
  });

  it('ignores the installment marker on a debit card', async () => {
    const card = await createDebit();
    await commit(card, rowsFrom(CREDIT_CARD_CSV, card));
    expect(await db.installmentPlans.count()).toBe(0);
    expect(
      (await db.transactions.toArray()).find((t) => t.description.includes('TEKNOSA'))?.amount,
    ).toBe(50_000);
  });

  it('undoes a whole import, including its plans and payments', async () => {
    const card = await createCredit();
    await seedAugustCharge(card);
    const usage = async () => computeCardUsage((await loadUsageInputs([card], TODAY))[0]!);
    const before = await usage();

    const importId = await commit(card, rowsFrom(CREDIT_CARD_CSV, card));
    expect((await usage()).used).not.toBe(before.used);

    await importsRepo.undo(importId);
    expect(await db.transactions.count()).toBe(1);
    expect(await db.installmentPlans.count()).toBe(0);
    expect(await db.payments.count()).toBe(0);
    expect(await db.statements.count()).toBe(0);
    expect(await importsRepo.list()).toEqual([]);
    expect(await usage()).toEqual(before);
  });

  it('keeps payments recorded by hand when undoing', async () => {
    const card = await createCredit();
    await seedAugustCharge(card);
    const importId = await commit(card, rowsFrom(CREDIT_CARD_CSV, card));
    const input = billingInput((await loadUsageInputs([card], TODAY))[0]!)!;
    const { computeBill, statementPeriodFor } = await import('../core/finance');
    const october = computeBill(statementPeriodFor('2026-10-10', input.card), input);
    await paymentsRepo.record(card, october, 10_000, '2026-10-12');

    await importsRepo.undo(importId);
    expect((await db.payments.toArray()).map((p) => p.amount)).toEqual([10_000]);
  });

  it('saves and finds profiles by header signature', async () => {
    const options = {
      headerRow: 2,
      decimal: ',',
      dateOrder: 'DMY',
      chargeSign: 'positive',
    } as const;
    const id = await importsRepo.saveProfile({
      name: 'Garanti CSV',
      headerSignature: 'a|b',
      columnMap: { date: '0' },
      options,
    });
    const again = await importsRepo.saveProfile({
      name: 'Garanti BBVA',
      headerSignature: 'a|b',
      columnMap: { date: '1' },
      options,
    });
    expect(again).toBe(id);
    expect(await importsRepo.findProfile('a|b')).toMatchObject({
      name: 'Garanti BBVA',
      columnMap: { date: '1' },
      kind: 'csv',
    });
    expect(await importsRepo.findProfile('x')).toBeUndefined();
  });

  it('removes a card’s imports when the card is deleted', async () => {
    const card = await createDebit();
    await commit(card, rowsFrom(DEBIT_CARD_CSV, card));
    await cardsRepo.deletePermanently(card.id);
    expect(await importsRepo.list()).toEqual([]);
  });
});
