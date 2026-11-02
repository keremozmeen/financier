import { isFullyPaid, type Bill } from '../core/finance';
import type { Card, IsoDate, Payment, PaymentMethod, Statement } from '../types/domain';
import { db, newId } from './database';

export const paymentsRepo = {
  /** Newest first. */
  async listByCard(cardId: string): Promise<Payment[]> {
    const rows = await db.payments.where('cardId').equals(cardId).toArray();
    return rows.sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  },

  /**
   * Records a payment towards a computed bill (D14). The statement is stored on its
   * first payment, as a snapshot of the bill; it is marked paid, which releases its
   * installments, once the payments cover the amount due. Paying more than that is
   * allowed: the excess becomes a credit balance (D15).
   */
  async record(
    card: Pick<Card, 'id' | 'type' | 'currency'>,
    bill: Bill,
    amount: number,
    date: IsoDate,
    { method = 'manual', now = new Date() }: { method?: PaymentMethod; now?: Date } = {},
  ): Promise<string> {
    if (card.type !== 'credit') {
      throw new RangeError('Only credit cards have statements and payments (D13, D14)');
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new RangeError('Payment must be a positive integer in minor units');
    }
    if (bill.amountDue <= 0) throw new RangeError('This statement has nothing to pay');

    const id = newId();
    await db.transaction('rw', db.statements, db.payments, async () => {
      const stored = (await db.statements.where('cardId').equals(card.id).toArray()).find(
        (statement) => statement.periodEnd === bill.periodEnd,
      );
      const statementId = stored?.id ?? newId();
      const earlier = await db.payments.where('statementId').equals(statementId).toArray();
      const paidAmount = earlier.reduce((sum, p) => sum + p.amount, 0) + amount;

      await db.statements.put({
        id: statementId,
        cardId: card.id,
        periodStart: bill.periodStart,
        periodEnd: bill.periodEnd,
        dueDate: bill.dueDate,
        // What the bank asked for after credit (D15); covering it settles the statement.
        totalDue: bill.amountDue,
        paid: isFullyPaid(bill.amountDue, paidAmount),
        installments: bill.installments,
      });
      await db.payments.add({
        id,
        cardId: card.id,
        statementId,
        date,
        amount,
        currency: card.currency,
        createdAt: now.toISOString(),
        method,
      });
    });
    return id;
  },

  /**
   * "Paid outside the app" for an overdue bill (D14): records the full remaining amount
   * on its due date, which settles the statement.
   */
  markPaidOutside(card: Pick<Card, 'id' | 'type' | 'currency'>, bill: Bill): Promise<string> {
    return paymentsRepo.record(card, bill, bill.remaining, bill.dueDate, { method: 'outside' });
  },

  /** Removes a payment; its statement is re-settled, and dropped when no payment is left. */
  async remove(id: string): Promise<void> {
    await db.transaction('rw', db.statements, db.payments, async () => {
      const payment = await db.payments.get(id);
      if (!payment) return;
      await db.payments.delete(id);
      const rest = await db.payments.where('statementId').equals(payment.statementId).toArray();
      if (rest.length === 0) {
        await db.statements.delete(payment.statementId);
        return;
      }
      const statement = await db.statements.get(payment.statementId);
      if (!statement) return;
      const paidAmount = rest.reduce((sum, p) => sum + p.amount, 0);
      await db.statements.update(payment.statementId, {
        paid: isFullyPaid(statement.totalDue, paidAmount),
      } satisfies Partial<Statement>);
    });
  },
};
