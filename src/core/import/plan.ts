import type {
  BalanceOverride,
  Card,
  CreditCard,
  InstallmentPlan,
  IsoDate,
  IsoMonth,
  Payment,
  Statement,
  Transaction,
} from '../../types/domain';
import {
  addDays,
  addMonths,
  computeBill,
  daysBetween,
  installmentSchedule,
  normalizeDescription,
  splitInstallments,
  statementPeriodFor,
  transactionFingerprint,
  type BillingInput,
} from '../finance';
import { signedAmount, type DraftRow } from './draft';
import { similarDescriptions } from './similar';

/** Days either side within which an import matches a manual entry or a payment (D3, D16). */
export const MATCH_WINDOW_DAYS = 3;

/** What saving a reviewed row will do (D16, D17). */
export type RowOutcome =
  | { kind: 'invalid'; problem: 'date' | 'amount' | 'installment' }
  | { kind: 'dropped' }
  | {
      kind: 'skip';
      reason:
        | 'summary'
        | 'nothingToPay'
        /** A bill payment on a debit card, with no credit card in the app to pay. */
        | 'debitPayment'
        /** A bill payment from the account whose credit card the user has not picked. */
        | 'pickCard'
        /** An outgoing transfer or ATM withdrawal, not counted as spending (D17). */
        | 'transfer';
    }
  /** Already imported: its fingerprint is stored (D3). */
  | { kind: 'duplicate' }
  /** "Already logged": the same as a manual entry, merged into it (D3). */
  | { kind: 'merge'; transactionId: string; fillDescription: boolean }
  /** A new transaction. `manualMatch` is set when the user unmerged it. */
  | {
      kind: 'add';
      fingerprint: string;
      flag?: 'fee' | 'income' | 'bill' | 'transfer';
      manualMatch?: string;
    }
  /** An installment slice the plan already bills. */
  | { kind: 'link'; planId: string; fillDescription: boolean }
  /** An installment slice with no plan yet: creates one for the remaining installments. */
  | {
      kind: 'newPlan';
      count: number;
      totalAmount: number;
      firstDueMonth: IsoMonth;
      fingerprint: string;
    }
  /** A bill payment on credit card `cardId` against the statement closing on `periodEnd` (D14). */
  | {
      kind: 'payment';
      cardId: string;
      periodEnd: IsoDate;
      dueDate: IsoDate;
      amountDue: number;
    }
  /** A payment already stored (any method), or one auto-pay makes (D14). */
  | { kind: 'paymentRecorded'; cardId: string; reason: 'recorded' | 'autoPay' };

/** What is already stored for one card. */
export interface CardRecords {
  transactions: readonly Transaction[];
  plans: readonly InstallmentPlan[];
  statements: readonly Statement[];
  payments: readonly Payment[];
  overrides: readonly BalanceOverride[];
}

export interface ImportContext extends CardRecords {
  /** The card the file is imported onto. */
  card: Card;
  /** Active credit cards a debit account can pay bills for (D17), with their records. */
  creditCards?: readonly ({ card: CreditCard } & CardRecords)[];
}

export interface PlannedRow {
  row: DraftRow;
  outcome: RowOutcome;
}

/** Charges, plans and payments this import adds to a card, so payments see their bills. */
interface Pending {
  transactions: BillingInput['transactions'][number][];
  plans: BillingInput['plans'][number][];
  payments: BillingInput['payments'][number][];
}

/**
 * Decides what each reviewed row becomes (D3, D16, D17), in file order. Pure: the review
 * screen calls it again after every edit.
 */
export function planImport(rows: readonly DraftRow[], context: ImportContext): PlannedRow[] {
  const { card } = context;
  const currency = card.currency;
  const dueMonth = importDueMonth(rows, card);

  const imported = new Set(
    context.transactions.filter((tx) => tx.source !== 'manual').map((tx) => tx.fingerprint),
  );
  const manual = context.transactions.filter(
    (tx) => tx.source === 'manual' && !tx.installmentPlanId && tx.currency === currency,
  );
  const claimedManual = new Set<string>();
  const claimedPlans = new Set<string>();
  const occurrences = new Map<string, number>();
  const pending = new Map<string, Pending>();
  const pendingFor = (cardId: string) => {
    let entry = pending.get(cardId);
    if (!entry) pending.set(cardId, (entry = { transactions: [], plans: [], payments: [] }));
    return entry;
  };

  // Fingerprints are a property of the row's position in the file, so they are counted
  // before drops and merges: re-importing the same file finds the same ones. The bank's
  // "Referans" replaces date + amount + description when the file has one (D17).
  const fingerprints = rows.map((row) => {
    if (!isValid(row)) return '';
    const base = row.reference?.trim()
      ? `${card.id}|ref|${normalizeDescription(row.reference)}`
      : transactionFingerprint(card.id, row.date!, signedAmount(row), row.description);
    const n = (occurrences.get(base) ?? 0) + 1;
    occurrences.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  });

  return rows.map((row, i): PlannedRow => ({ row, outcome: decide(row, fingerprints[i]!) }));

  function decide(row: DraftRow, fingerprint: string): RowOutcome {
    if (row.dropped) return { kind: 'dropped' };
    if (row.type === 'summary') return { kind: 'skip', reason: 'summary' };
    if (!row.date) return { kind: 'invalid', problem: 'date' };
    if (!row.amount) return { kind: 'invalid', problem: 'amount' };
    const date = row.date;
    const amount = signedAmount(row);

    if (row.type === 'payment') {
      if (card.type === 'credit') return decidePayment({ ...context, card }, date, row.amount);
      // From a debit account, the payment belongs to one of the credit cards (D17).
      const targets = context.creditCards ?? [];
      if (targets.length === 0) return { kind: 'skip', reason: 'debitPayment' };
      const target = paymentTarget(row, targets);
      if (!target) return { kind: 'skip', reason: 'pickCard' };
      return decidePayment(target, date, row.amount);
    }

    if (row.type === 'transfer' && !row.countAsSpending)
      return { kind: 'skip', reason: 'transfer' };

    if (row.type === 'installment' && card.type === 'credit') {
      if (!row.installment) return { kind: 'invalid', problem: 'installment' };
      const plan = context.plans.find(
        (p) =>
          !claimedPlans.has(p.id) &&
          p.currency === currency &&
          (!p.description.trim() || similarDescriptions(p.description, row.description)) &&
          splitInstallments(p.totalAmount, p.count).includes(row.amount!) &&
          activeAround(p, dueMonth),
      );
      if (plan) {
        claimedPlans.add(plan.id);
        return { kind: 'link', planId: plan.id, fillDescription: !plan.description.trim() };
      }
      const count = row.installment.count - row.installment.index + 1;
      const totalAmount = row.amount * count;
      const own = pendingFor(card.id);
      const planId = `new:${row.line}`;
      own.plans.push({ id: planId, totalAmount, count, firstDueMonth: dueMonth, currency });
      own.transactions.push({ date, amount: totalAmount, currency, installmentPlanId: planId });
      return { kind: 'newPlan', count, totalAmount, firstDueMonth: dueMonth, fingerprint };
    }

    // Charges, refunds, fees, bills, income and counted transfers (and slices on a debit
    // card, D13).
    if (imported.has(fingerprint)) return { kind: 'duplicate' };
    const flag = FLAGS[row.type];
    // Income merges only with manual income, and charges and refunds never with it.
    const income = row.type === 'income';
    const match = manual
      .filter(
        (tx) =>
          !claimedManual.has(tx.id) &&
          !!tx.income === income &&
          tx.amount === amount &&
          Math.abs(daysBetween(tx.date, date)) <= MATCH_WINDOW_DAYS,
      )
      .sort((a, b) => Math.abs(daysBetween(a.date, date)) - Math.abs(daysBetween(b.date, date)))[0];
    if (match && !row.unmerged) {
      claimedManual.add(match.id);
      return { kind: 'merge', transactionId: match.id, fillDescription: !match.description.trim() };
    }
    if (match) claimedManual.add(match.id);
    pendingFor(card.id).transactions.push({ date, amount, currency });
    return {
      kind: 'add',
      fingerprint,
      ...(flag ? { flag } : {}),
      ...(match ? { manualMatch: match.id } : {}),
    };
  }

  function decidePayment(
    target: { card: CreditCard } & CardRecords,
    date: IsoDate,
    amount: number,
  ): RowOutcome {
    const { card: credit } = target;
    const recorded = target.payments.some(
      (p) =>
        p.currency === credit.currency &&
        p.amount === amount &&
        Math.abs(daysBetween(p.date, date)) <= MATCH_WINDOW_DAYS,
    );
    if (recorded) return { kind: 'paymentRecorded', cardId: credit.id, reason: 'recorded' };

    const extra = pendingFor(credit.id);
    const input: BillingInput = {
      card: credit,
      transactions: [...target.transactions, ...extra.transactions],
      plans: [...target.plans, ...extra.plans],
      statements: target.statements,
      payments: [...target.payments, ...extra.payments],
      overrides: target.overrides,
    };
    const bill = computeBill(statementPaidBy(date, credit), input);

    // Auto-pay settles each bill on its due date (D14): the bank's row is that payment.
    if (
      credit.autoPay &&
      credit.autoPaySince &&
      bill.dueDate >= credit.autoPaySince &&
      Math.abs(daysBetween(bill.dueDate, date)) <= MATCH_WINDOW_DAYS
    ) {
      return { kind: 'paymentRecorded', cardId: credit.id, reason: 'autoPay' };
    }
    if (bill.amountDue <= 0) return { kind: 'skip', reason: 'nothingToPay' };

    // Later payment rows in the file see this one when they pay the same statement.
    extra.payments.push({
      statementId: `new:${bill.periodEnd}`,
      date,
      amount,
      currency: credit.currency,
      createdAt: '',
    });
    return {
      kind: 'payment',
      cardId: credit.id,
      periodEnd: bill.periodEnd,
      dueDate: bill.dueDate,
      amountDue: bill.amountDue,
    };
  }
}

const FLAGS: Partial<Record<DraftRow['type'], 'fee' | 'income' | 'bill' | 'transfer'>> = {
  fee: 'fee',
  income: 'income',
  bill: 'bill',
  transfer: 'transfer',
};

/**
 * The credit card a bill payment from the account paid (D17): the one the user picked,
 * else the only card whose last 4 digits appear in the description, else the only
 * credit card in the app.
 */
export function paymentTarget<T extends { card: CreditCard }>(
  row: Pick<DraftRow, 'targetCardId' | 'description'>,
  targets: readonly T[],
): T | undefined {
  if (row.targetCardId) return targets.find((t) => t.card.id === row.targetCardId);
  const digits = new Set([...row.description.matchAll(/(?<!\d)(\d{4})(?!\d)/g)].map((m) => m[1]));
  const byLast4 = targets.filter((t) => t.card.last4 && digits.has(t.card.last4));
  if (byLast4.length === 1) return byLast4[0];
  return targets.length === 1 ? targets[0] : undefined;
}

function isValid(row: DraftRow): boolean {
  return row.date !== null && row.amount !== null && row.amount > 0;
}

/**
 * The month the imported statement is due in (D16): the statement period containing
 * the latest date in the file. Installment slices are billed in it. Debit cards have
 * no statements, so the month of the latest date is used.
 */
export function importDueMonth(rows: readonly DraftRow[], card: Card): IsoMonth {
  const dates = rows
    .filter((row) => !row.dropped && row.type !== 'summary' && row.date)
    .map((row) => row.date as IsoDate)
    .sort();
  const latest = dates.at(-1) ?? '1970-01-01';
  return card.type === 'credit' ? statementPeriodFor(latest, card).dueMonth : latest.slice(0, 7);
}

/** The statement a payment on `date` pays: the latest one that closed before it. */
export function statementPaidBy(date: IsoDate, card: CreditCard) {
  const open = statementPeriodFor(date, card);
  return statementPeriodFor(addDays(open.periodStart, -1), card);
}

/** The plan bills an installment in `month`, give or take a month. */
function activeAround(plan: InstallmentPlan, month: IsoMonth): boolean {
  const schedule = installmentSchedule(plan);
  const first = schedule[0]!.dueMonth;
  const last = schedule.at(-1)!.dueMonth;
  return addMonths(first, -1) <= month && month <= addMonths(last, 1);
}

/** How many rows end up in each outcome, for the review summary and the import record. */
export type ImportCounts = Record<RowOutcome['kind'], number>;

export function countOutcomes(planned: readonly PlannedRow[]): ImportCounts {
  const counts: ImportCounts = {
    invalid: 0,
    dropped: 0,
    skip: 0,
    duplicate: 0,
    merge: 0,
    add: 0,
    link: 0,
    newPlan: 0,
    payment: 0,
    paymentRecorded: 0,
  };
  for (const { outcome } of planned) counts[outcome.kind]++;
  return counts;
}
