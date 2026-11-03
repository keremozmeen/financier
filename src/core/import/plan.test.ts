import type {
  Card,
  CreditCard,
  DebitCard,
  InstallmentPlan,
  Payment,
  Transaction,
} from '../../types/domain';
import { transactionFingerprint } from '../finance';
import { importChanges } from './changes';
import { draftRows, editDraft, type DraftRow } from './draft';
import { countOutcomes, importDueMonth, planImport, type ImportContext } from './plan';
import { similarDescriptions } from './similar';

const credit: CreditCard = {
  id: 'c1',
  type: 'credit',
  name: 'Bonus',
  bank: '',
  last4: '',
  currency: 'TRY',
  color: '#000',
  archived: false,
  limit: 10_000_000,
  statementDay: 10,
  dueDay: 20,
};
const debit: DebitCard = {
  id: 'd1',
  type: 'debit',
  name: 'Maaş',
  bank: '',
  last4: '',
  currency: 'TRY',
  color: '#000',
  archived: false,
};

let line = 0;
function row(patch: Partial<DraftRow> = {}): DraftRow {
  line++;
  return {
    line,
    date: '2026-09-15',
    description: 'MIGROS',
    amount: 10_000,
    type: 'charge',
    confidence: 'high',
    dropped: false,
    unmerged: false,
    ...patch,
  };
}

function tx(patch: Partial<Transaction> = {}, card: Card = credit): Transaction {
  const base = {
    id: `t${++line}`,
    cardId: card.id,
    date: '2026-09-15',
    description: '',
    normalizedMerchant: '',
    amount: 10_000,
    currency: 'TRY',
    category: 'uncategorized',
    source: 'manual' as const,
    ...patch,
  };
  return {
    ...base,
    fingerprint:
      patch.fingerprint ??
      transactionFingerprint(base.cardId, base.date, base.amount, base.description),
  };
}

function plan(patch: Partial<InstallmentPlan> = {}): InstallmentPlan {
  return {
    id: `p${++line}`,
    cardId: credit.id,
    description: 'Teknosa',
    totalAmount: 300_000,
    count: 6,
    purchaseDate: '2026-07-15',
    firstDueMonth: '2026-08',
    currency: 'TRY',
    ...patch,
  };
}

function payment(patch: Partial<Payment> = {}): Payment {
  return {
    id: `pay${++line}`,
    cardId: credit.id,
    statementId: 's1',
    date: '2026-09-16',
    amount: 100_000,
    currency: 'TRY',
    createdAt: '2026-09-16T10:00:00.000Z',
    method: 'manual',
    ...patch,
  };
}

function context(patch: Partial<ImportContext> = {}): ImportContext {
  return {
    card: credit,
    transactions: [],
    plans: [],
    statements: [],
    payments: [],
    overrides: [],
    ...patch,
  };
}

const outcomes = (rows: DraftRow[], ctx = context()) => planImport(rows, ctx).map((p) => p.outcome);

describe('draftRows', () => {
  it('classifies parsed rows and keeps amounts positive', () => {
    const drafts = draftRows(
      [
        { line: 1, date: '2026-09-15', description: 'MIGROS', amount: 10_000, guessed: false },
        { line: 2, date: '2026-09-16', description: 'ÖDEME', amount: -50_000, guessed: false },
        {
          line: 3,
          date: '2026-09-17',
          description: 'TEKNOSA TAKSİT 3/6',
          amount: 50_000,
          guessed: true,
        },
      ],
      'credit',
    );
    expect(drafts.map((d) => [d.type, d.amount, d.confidence])).toEqual([
      ['charge', 10_000, 'high'],
      ['payment', 50_000, 'high'],
      ['installment', 50_000, 'low'],
    ]);
    expect(drafts[2]?.installment).toEqual({ index: 3, count: 6, keyword: true });
  });

  it('reads installment slices on a debit card as charges (D13)', () => {
    const [draft] = draftRows(
      [
        {
          line: 1,
          date: '2026-09-17',
          description: 'TEKNOSA TAKSİT 3/6',
          amount: 50_000,
          guessed: false,
        },
      ],
      'debit',
    );
    expect(draft).toMatchObject({ type: 'charge' });
    expect(draft).not.toHaveProperty('installment');
  });

  it('reads the marker from the description when the user picks installment', () => {
    const draft = editDraft(row({ description: 'TEKNOSA 2/4' }), { type: 'installment' });
    expect(draft.installment).toEqual({ index: 2, count: 4, keyword: false });
  });
});

describe('planImport', () => {
  describe('charges, refunds, fees and summary lines', () => {
    it('adds charges, refunds and fees and skips summary lines', () => {
      const rows = [
        row(),
        row({ type: 'refund', description: 'ZARA IADE' }),
        row({ type: 'fee', description: 'BSMV' }),
        row({ type: 'summary', description: 'DÖNEM BORCU', amount: 1_000_000 }),
      ];
      const planned = planImport(rows, context());
      expect(planned.map((p) => p.outcome.kind)).toEqual(['add', 'add', 'add', 'skip']);
      expect(planned[2]?.outcome).toMatchObject({ fee: true });

      const changes = importChanges(planned, credit, 'csv');
      expect(changes.transactions.map((t) => [t.description, t.amount, t.fee])).toEqual([
        ['MIGROS', 10_000, undefined],
        ['ZARA IADE', -10_000, undefined],
        ['BSMV', 10_000, true],
      ]);
      expect(changes.transactions[0]).toMatchObject({
        source: 'csv',
        cardId: 'c1',
        currency: 'TRY',
      });
    });

    it('marks unreadable rows invalid and leaves dropped rows out', () => {
      expect(
        outcomes([
          row({ date: null }),
          row({ amount: null }),
          row({ amount: 0 }),
          row({ dropped: true }),
        ]),
      ).toEqual([
        { kind: 'invalid', problem: 'date' },
        { kind: 'invalid', problem: 'amount' },
        { kind: 'invalid', problem: 'amount' },
        { kind: 'dropped' },
      ]);
    });

    it('skips summary lines even when they could not be read', () => {
      expect(outcomes([row({ type: 'summary', date: null, amount: null })])).toEqual([
        { kind: 'skip', reason: 'summary' },
      ]);
    });
  });

  describe('fingerprint dedup (D3)', () => {
    it('skips rows imported before', () => {
      const earlier = tx({ source: 'csv', description: 'MIGROS' });
      expect(outcomes([row()], context({ transactions: [earlier] }))).toEqual([
        { kind: 'duplicate' },
      ]);
    });

    it('keeps identical rows in one file and finds both again on re-import', () => {
      const rows = [row(), row()];
      const first = planImport(rows, context());
      expect(first.map((p) => p.outcome.kind)).toEqual(['add', 'add']);
      const saved = importChanges(first, credit, 'csv').transactions.map((t, i) =>
        tx({ ...t, id: `x${i}` }),
      );
      expect(saved[1]?.fingerprint).toBe(`${saved[0]?.fingerprint}#2`);

      const again = [row({ line: rows[0]!.line }), row({ line: rows[1]!.line })];
      expect(outcomes(again, context({ transactions: saved }))).toEqual([
        { kind: 'duplicate' },
        { kind: 'duplicate' },
      ]);
    });

    it('adds a second identical row when only the first was imported', () => {
      const earlier = tx({ source: 'csv', description: 'MIGROS' });
      expect(
        outcomes([row(), row()], context({ transactions: [earlier] })).map((o) => o.kind),
      ).toEqual(['duplicate', 'add']);
    });

    it('never deduplicates against manual entries by fingerprint', () => {
      const manual = tx({ description: 'MIGROS', date: '2026-09-01' });
      expect(outcomes([row()], context({ transactions: [manual] }))[0]?.kind).toBe('add');
    });
  });

  describe('merging with manual entries (D3)', () => {
    it('merges a charge with a manual entry within 3 days and fills its description', () => {
      const manual = tx({ date: '2026-09-12' });
      const planned = planImport([row()], context({ transactions: [manual] }));
      expect(planned[0]?.outcome).toEqual({
        kind: 'merge',
        transactionId: manual.id,
        fillDescription: true,
      });
      expect(importChanges(planned, credit, 'csv')).toMatchObject({
        transactions: [],
        merges: [{ transactionId: manual.id, description: 'MIGROS' }],
      });
    });

    it('keeps the manual description when there is one', () => {
      const manual = tx({ description: 'Groceries' });
      const planned = planImport([row()], context({ transactions: [manual] }));
      expect(planned[0]?.outcome).toMatchObject({ kind: 'merge', fillDescription: false });
      expect(importChanges(planned, credit, 'csv').merges).toEqual([]);
    });

    it('merges refunds too, by signed amount', () => {
      const manual = tx({ amount: -10_000 });
      expect(
        outcomes([row({ type: 'refund' })], context({ transactions: [manual] }))[0]?.kind,
      ).toBe('merge');
      expect(
        outcomes([row({ type: 'charge' })], context({ transactions: [manual] }))[0]?.kind,
      ).toBe('add');
    });

    it('does not merge outside 3 days, other amounts, or imported entries', () => {
      const transactions = [
        tx({ date: '2026-09-11' }),
        tx({ amount: 10_001 }),
        tx({ source: 'csv', description: 'Other' }),
      ];
      expect(outcomes([row()], context({ transactions }))[0]?.kind).toBe('add');
    });

    it('merges each manual entry with one row only, the closest first', () => {
      const near = tx({ date: '2026-09-15' });
      const far = tx({ date: '2026-09-17' });
      const planned = outcomes(
        [row({ date: '2026-09-15' }), row({ date: '2026-09-16' }), row()],
        context({ transactions: [far, near] }),
      );
      expect(planned).toEqual([
        expect.objectContaining({ kind: 'merge', transactionId: near.id }),
        expect.objectContaining({ kind: 'merge', transactionId: far.id }),
        expect.objectContaining({ kind: 'add' }),
      ]);
    });

    it('adds the row when the user unmerges it, remembering the match', () => {
      const manual = tx();
      expect(
        outcomes([row({ unmerged: true })], context({ transactions: [manual] }))[0],
      ).toMatchObject({
        kind: 'add',
        manualMatch: manual.id,
      });
    });

    it('ignores manual installment purchases (plans are matched as slices)', () => {
      const purchase = tx({ installmentPlanId: 'p1' });
      expect(outcomes([row()], context({ transactions: [purchase] }))[0]?.kind).toBe('add');
    });

    it('merges with manual entries on debit cards', () => {
      const manual = tx({}, debit);
      expect(outcomes([row()], context({ card: debit, transactions: [manual] }))[0]?.kind).toBe(
        'merge',
      );
    });
  });

  describe('installment slices (D16)', () => {
    const slice = (patch: Partial<DraftRow> = {}) =>
      row({
        type: 'installment',
        description: 'TEKNOSA ISTANBUL TAKSİT 3/6',
        amount: 50_000,
        date: '2026-10-05',
        installment: { index: 3, count: 6, keyword: true },
        ...patch,
      });

    it('bills slices in the statement the file covers', () => {
      expect(importDueMonth([slice(), row({ date: '2026-10-10' })], credit)).toBe('2026-10');
      expect(importDueMonth([row({ date: '2026-10-11' })], credit)).toBe('2026-11');
      expect(importDueMonth([row({ date: '2026-10-11' })], debit)).toBe('2026-10');
    });

    it('links to a plan with a similar description and the same installment amount', () => {
      const existing = plan();
      const planned = planImport([slice()], context({ plans: [existing] }));
      expect(planned[0]?.outcome).toEqual({
        kind: 'link',
        planId: existing.id,
        fillDescription: false,
      });
      expect(importChanges(planned, credit, 'csv')).toMatchObject({
        transactions: [],
        plans: [],
        links: [],
      });
    });

    it('matches the first installment that carries the remainder', () => {
      const existing = plan({ totalAmount: 100_000, count: 3 }); // 33.334 + 2 × 33.333
      expect(outcomes([slice({ amount: 33_334 })], context({ plans: [existing] }))[0]?.kind).toBe(
        'link',
      );
      expect(outcomes([slice({ amount: 33_333 })], context({ plans: [existing] }))[0]?.kind).toBe(
        'link',
      );
    });

    it('links a plan without a description on the amount and fills it in', () => {
      const existing = plan({ description: '' });
      const planned = planImport([slice()], context({ plans: [existing] }));
      expect(planned[0]?.outcome).toEqual({
        kind: 'link',
        planId: existing.id,
        fillDescription: true,
      });
      expect(importChanges(planned, credit, 'csv').links).toEqual([
        { planId: existing.id, description: 'TEKNOSA ISTANBUL TAKSİT 3/6' },
      ]);
    });

    it.each([
      ['another merchant', { description: 'Vatan Bilgisayar' }],
      ['another installment amount', { totalAmount: 600_000 }],
      ['a plan that ended', { firstDueMonth: '2026-01' }],
      ['a plan that starts later', { firstDueMonth: '2027-01' }],
      ['another currency', { currency: 'USD' }],
    ])('does not link to %s', (_, patch) => {
      expect(outcomes([slice()], context({ plans: [plan(patch)] }))[0]?.kind).toBe('newPlan');
    });

    it('creates a plan for the remaining installments when none matches', () => {
      const planned = planImport([slice(), row({ date: '2026-10-08' })], context());
      expect(planned[0]?.outcome).toMatchObject({
        kind: 'newPlan',
        count: 4,
        totalAmount: 200_000,
        firstDueMonth: '2026-10',
      });
      const changes = importChanges(planned, credit, 'csv');
      expect(changes.plans).toEqual([
        {
          plan: {
            cardId: 'c1',
            description: 'TEKNOSA ISTANBUL TAKSİT 3/6',
            totalAmount: 200_000,
            count: 4,
            purchaseDate: '2026-10-05',
            firstDueMonth: '2026-10',
            currency: 'TRY',
          },
          purchase: expect.objectContaining({ amount: 200_000, source: 'csv' }),
        },
      ]);
      // Never a separate charge.
      expect(changes.transactions).toHaveLength(1);
      expect(changes.transactions[0]?.description).toBe('MIGROS');
    });

    it('creates a one-installment plan for the last slice', () => {
      expect(
        outcomes([slice({ installment: { index: 6, count: 6, keyword: true } })])[0],
      ).toMatchObject({ kind: 'newPlan', count: 1, totalAmount: 50_000 });
    });

    it('links each plan to one slice only', () => {
      const existing = plan();
      expect(
        outcomes([slice(), slice()], context({ plans: [existing] })).map((o) => o.kind),
      ).toEqual(['link', 'newPlan']);
    });

    it('links next month’s slice to the plan an import created', () => {
      const first = planImport([slice()], context());
      const created = importChanges(first, credit, 'csv').plans[0]!.plan;
      const next = slice({
        date: '2026-11-05',
        installment: { index: 4, count: 6, keyword: true },
      });
      expect(outcomes([next], context({ plans: [{ ...created, id: 'new' }] }))[0]).toMatchObject({
        kind: 'link',
        planId: 'new',
      });
    });

    it('needs a marker', () => {
      expect(outcomes([slice({ installment: undefined })])[0]).toEqual({
        kind: 'invalid',
        problem: 'installment',
      });
    });
  });

  describe('bill payments (D14, D16)', () => {
    // A 1.000 ₺ charge on the statement 11 Aug – 10 Sep, due 21 Sep (20 Sep is a Sunday).
    const charge = tx({ date: '2026-08-20', amount: 100_000 });
    const pay = (patch: Partial<DraftRow> = {}) =>
      row({
        type: 'payment',
        description: 'HESAPTAN ÖDEME',
        amount: 100_000,
        date: '2026-09-16',
        ...patch,
      });

    it('offers the payment against the statement that closed before it', () => {
      const planned = planImport([pay()], context({ transactions: [charge] }));
      expect(planned[0]?.outcome).toEqual({
        kind: 'payment',
        periodEnd: '2026-09-10',
        dueDate: '2026-09-21',
        amountDue: 100_000,
      });
      expect(importChanges(planned, credit, 'csv')).toMatchObject({
        transactions: [],
        payments: [{ date: '2026-09-16', amount: 100_000, periodEnd: '2026-09-10' }],
      });
    });

    it('never imports a payment as a refund', () => {
      const changes = importChanges(
        planImport([pay()], context({ transactions: [charge] })),
        credit,
        'csv',
      );
      expect(changes.transactions).toEqual([]);
    });

    it.each(['manual', 'outside', 'automatic'] as const)(
      'skips a payment already recorded within 3 days (%s)',
      (method) => {
        const recorded = payment({ date: '2026-09-19', method });
        expect(
          outcomes([pay()], context({ transactions: [charge], payments: [recorded] }))[0],
        ).toEqual({
          kind: 'paymentRecorded',
          reason: 'recorded',
        });
      },
    );

    it('offers it when the recorded payment is 4 days away or another amount', () => {
      const payments = [payment({ date: '2026-09-20' }), payment({ amount: 99_999 })];
      expect(outcomes([pay()], context({ transactions: [charge], payments }))[0]?.kind).toBe(
        'payment',
      );
    });

    it('skips a payment auto-pay makes on the due date', () => {
      const card = { ...credit, autoPay: true, autoPaySince: '2026-09-01' };
      expect(
        outcomes(
          [pay({ date: '2026-09-21', amount: 123_400 })],
          context({ card, transactions: [charge] }),
        )[0],
      ).toEqual({ kind: 'paymentRecorded', reason: 'autoPay' });
    });

    it('offers payments auto-pay does not cover', () => {
      const card = { ...credit, autoPay: true, autoPaySince: '2026-10-01' };
      expect(
        outcomes([pay({ date: '2026-09-21' })], context({ card, transactions: [charge] }))[0]?.kind,
      ).toBe('payment');
      const early = { ...credit, autoPay: true, autoPaySince: '2026-09-01' };
      expect(
        outcomes([pay({ date: '2026-09-14' })], context({ card: early, transactions: [charge] }))[0]
          ?.kind,
      ).toBe('payment');
    });

    it('counts charges in the same file towards the statement', () => {
      const planned = outcomes([row({ date: '2026-08-25', amount: 40_000 }), pay()]);
      expect(planned[1]).toMatchObject({ kind: 'payment', amountDue: 40_000 });
    });

    it('skips a payment when the statement has nothing to pay', () => {
      expect(outcomes([pay()])[0]).toEqual({ kind: 'skip', reason: 'nothingToPay' });
    });

    it('skips payments on debit cards', () => {
      expect(outcomes([pay()], context({ card: debit }))[0]).toEqual({
        kind: 'skip',
        reason: 'debitPayment',
      });
    });
  });

  it('counts outcomes', () => {
    const counts = countOutcomes(
      planImport([row(), row({ type: 'summary' }), row({ dropped: true })], context()),
    );
    expect(counts).toMatchObject({ add: 1, skip: 1, dropped: 1, merge: 0 });
  });
});

describe('similarDescriptions', () => {
  it.each([
    ['TEKNOSA ISTANBUL TAKSİT 3/6', 'Teknosa'],
    ['TEKNOSA ISTANBUL', 'TEKNOSA KADIKOY'],
    ['APPLE STORE ZORLU', 'Zorlu Apple Store'],
  ])('matches %s and %s', (a, b) => {
    expect(similarDescriptions(a, b)).toBe(true);
  });

  it.each([
    ['TEKNOSA', 'VATAN'],
    ['A', 'A'],
    ['MEDIAMARKT ISTANBUL', 'TEKNOSA ISTANBUL MAGAZA'],
  ])('does not match %s and %s', (a, b) => {
    expect(similarDescriptions(a, b)).toBe(false);
  });
});
