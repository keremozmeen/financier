import {
  billingInput,
  cardsRepo,
  loadCardSummaries,
  loadUsageInputs,
  paymentsRepo,
  transactionsRepo,
} from '.';
import { paidInstallments, upcomingBill } from '../core/finance';
import type { CreditCard, DebitCard } from '../types/domain';
import { db } from './database';

const today = '2026-11-12';

/** Statement on the 10th, due on the 20th; limit 50.000 ₺. */
async function createCard() {
  const id = await cardsRepo.create({
    type: 'credit',
    name: 'Bonus',
    bank: 'Garanti BBVA',
    last4: '1234',
    currency: 'TRY',
    limit: 5_000_000,
    statementDay: 10,
    dueDay: 20,
    color: '#34d399',
  });
  return (await cardsRepo.get(id)) as CreditCard;
}

/**
 * A 1.000 ₺ charge and a 1.200 ₺ purchase in 3 installments on October 15. The
 * statement closing November 10 bills the charge and the first installment: 1.400 ₺.
 */
async function seed() {
  const card = await createCard();
  const base = { card, date: '2026-10-15', description: '', kind: 'charge' } as const;
  await transactionsRepo.addManual({ ...base, amount: 100_000, installments: 1 });
  await transactionsRepo.addManual({ ...base, amount: 120_000, installments: 3 });
  return card;
}

async function state(card: CreditCard) {
  const [input] = await loadUsageInputs([card], today);
  const [summary] = await loadCardSummaries([card], today);
  return {
    input: input!,
    bill: upcomingBill(billingInput(input!)!, today),
    used: 'usage' in summary! ? summary.usage.used : undefined,
  };
}

describe('paymentsRepo (D14)', () => {
  it('a full payment stores the statement as paid and releases its installments', async () => {
    const card = await seed();
    const { bill, used } = await state(card);
    expect(bill).toMatchObject({ periodEnd: '2026-11-10', total: 140_000 });
    expect(used).toBe(220_000);

    await paymentsRepo.record(card, bill, 140_000, '2026-11-12');

    const after = await state(card);
    expect(after.used).toBe(80_000);
    expect(after.input.statements).toEqual([
      expect.objectContaining({
        periodEnd: '2026-11-10',
        dueDate: '2026-11-20',
        totalDue: 140_000,
        paid: true,
      }),
    ]);
    expect(paidInstallments(after.input.statements)).toEqual([
      expect.objectContaining({ index: 0, amount: 40_000 }),
    ]);
    // The next bill is the open statement: the second installment, due December 21.
    expect(after.bill).toMatchObject({ periodEnd: '2026-12-10', dueDate: '2026-12-21' });
  });

  it('a partial payment reduces used but marks no installments as paid', async () => {
    const card = await seed();
    await paymentsRepo.record(card, (await state(card)).bill, 50_000, '2026-11-12');

    const after = await state(card);
    expect(after.used).toBe(170_000);
    expect(after.input.statements[0]).toMatchObject({ paid: false });
    expect(paidInstallments(after.input.statements)).toEqual([]);
    expect(after.bill).toMatchObject({
      periodEnd: '2026-11-10',
      paidAmount: 50_000,
      remaining: 90_000,
    });
  });

  it('settles the statement when a later payment covers the rest', async () => {
    const card = await seed();
    await paymentsRepo.record(card, (await state(card)).bill, 50_000, '2026-11-11');
    await paymentsRepo.record(card, (await state(card)).bill, 90_000, '2026-11-12');

    const after = await state(card);
    expect(await db.statements.count()).toBe(1);
    expect(after.input.statements[0]).toMatchObject({ paid: true });
    expect(after.used).toBe(80_000);
  });

  it('removing a payment re-settles the statement and drops it with the last payment', async () => {
    const card = await seed();
    const first = await paymentsRepo.record(card, (await state(card)).bill, 50_000, '2026-11-11');
    const second = await paymentsRepo.record(card, (await state(card)).bill, 90_000, '2026-11-12');

    await paymentsRepo.remove(second);
    expect((await state(card)).input.statements[0]).toMatchObject({ paid: false });
    expect((await state(card)).used).toBe(170_000);

    await paymentsRepo.remove(first);
    expect(await db.statements.count()).toBe(0);
    expect((await state(card)).used).toBe(220_000);
  });

  it('lists payments newest first', async () => {
    const card = await seed();
    await paymentsRepo.record(card, (await state(card)).bill, 10_000, '2026-11-11');
    await paymentsRepo.record(card, (await state(card)).bill, 20_000, '2026-11-12');
    expect((await paymentsRepo.listByCard(card.id)).map((p) => p.amount)).toEqual([20_000, 10_000]);
  });

  it('rejects debit cards, non-positive amounts and empty statements', async () => {
    const card = await seed();
    const { bill } = await state(card);
    const debitId = await cardsRepo.create({
      type: 'debit',
      name: 'Maaş kartı',
      bank: '',
      last4: '',
      currency: 'TRY',
      color: '#38bdf8',
    });
    const debit = (await cardsRepo.get(debitId)) as DebitCard;

    await expect(paymentsRepo.record(debit, bill, 100, today)).rejects.toThrow(RangeError);
    await expect(paymentsRepo.record(card, bill, 0, today)).rejects.toThrow(RangeError);
    await expect(paymentsRepo.record(card, bill, 1.5, today)).rejects.toThrow(RangeError);
    await expect(
      paymentsRepo.record(card, { ...bill, amountDue: 0, remaining: 0 }, 100, today),
    ).rejects.toThrow(RangeError);
    expect(await db.payments.count()).toBe(0);
  });

  it('deleting a card removes its statements and payments', async () => {
    const card = await seed();
    await paymentsRepo.record(card, (await state(card)).bill, 140_000, today);
    await cardsRepo.deletePermanently(card.id);
    expect(await db.statements.count()).toBe(0);
    expect(await db.payments.count()).toBe(0);
  });
});

describe('auto-pay (D14)', () => {
  /** An auto-pay card turned on November 1 with a 1.000 ₺ charge on the statement due November 20. */
  async function seedAutoPay(extra: Partial<CreditCard> = {}) {
    const card = await createCard();
    await cardsRepo.update(card.id, {
      type: 'credit',
      name: card.name,
      bank: card.bank,
      last4: card.last4,
      currency: card.currency,
      limit: card.limit,
      statementDay: card.statementDay,
      dueDay: card.dueDay,
      color: card.color,
      autoPay: true,
      autoPaySince: '2026-11-01',
      ...extra,
    });
    await transactionsRepo.addManual({
      card,
      date: '2026-11-05',
      description: '',
      kind: 'charge',
      amount: 100_000,
      installments: 1,
    });
    return (await cardsRepo.get(card.id)) as CreditCard;
  }

  it('records each closed bill as fully paid on its due date, flagged automatic', async () => {
    const card = await seedAutoPay();
    expect(await paymentsRepo.applyAutoPayments('2026-11-19')).toBe(0);
    expect(await paymentsRepo.applyAutoPayments('2026-11-25')).toBe(1);

    expect(await paymentsRepo.listByCard(card.id)).toEqual([
      expect.objectContaining({ date: '2026-11-20', amount: 100_000, method: 'automatic' }),
    ]);
    const [summary] = await loadCardSummaries([card], '2026-11-25');
    expect(summary).toMatchObject({ usage: { used: 0 } });
  });

  it('records each payment once, even when runs overlap', async () => {
    const card = await seedAutoPay();
    await Promise.all([
      paymentsRepo.applyAutoPayments('2026-11-25'),
      paymentsRepo.applyAutoPayments('2026-11-25'),
    ]);
    await paymentsRepo.applyAutoPayments('2026-11-26');
    expect(await paymentsRepo.listByCard(card.id)).toHaveLength(1);
  });

  it('does not record a deleted automatic payment again', async () => {
    const card = await seedAutoPay();
    await paymentsRepo.applyAutoPayments('2026-11-25');
    const [payment] = await paymentsRepo.listByCard(card.id);

    await paymentsRepo.remove(payment!.id);
    expect(await db.statements.toArray()).toEqual([
      expect.objectContaining({ periodEnd: '2026-11-10', paid: false, autoPaySkipped: true }),
    ]);
    expect(await paymentsRepo.applyAutoPayments('2026-11-26')).toBe(0);

    // A manual payment on that statement keeps the mark.
    const [input] = await loadUsageInputs([card], '2026-11-26');
    const bill = upcomingBill(billingInput(input!)!, '2026-11-12');
    await paymentsRepo.record(card, bill, 10_000, '2026-11-26');
    expect(await db.statements.toArray()).toEqual([
      expect.objectContaining({ autoPaySkipped: true }),
    ]);
  });

  it('ignores cards without auto-pay and archived cards', async () => {
    await seedAutoPay({ autoPay: undefined, autoPaySince: undefined });
    const archived = await seedAutoPay();
    await cardsRepo.setArchived(archived.id, true);
    expect(await paymentsRepo.applyAutoPayments('2026-11-25')).toBe(0);
  });
});
