import { cardsRepo, loadCardSummaries, loadUsageInputs, paymentsRepo, transactionsRepo } from '.';
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
    bill: upcomingBill(input!, today),
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
      paymentsRepo.record(card, { ...bill, total: 0, remaining: 0 }, 100, today),
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
