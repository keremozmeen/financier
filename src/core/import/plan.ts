import type {
  BalanceOverride,
  Card,
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
  splitInstallments,
  statementPeriodFor,
  transactionFingerprint,
  type BillingInput,
} from '../finance';
import { signedAmount, type DraftRow } from './draft';
import { similarDescriptions } from './similar';

/** Days either side within which an import matches a manual entry or a payment (D3, D16). */
export const MATCH_WINDOW_DAYS = 3;

/** What saving a reviewed row will do (D16). */
export type RowOutcome =
  | { kind: 'invalid'; problem: 'date' | 'amount' | 'installment' }
  | { kind: 'dropped' }
  | { kind: 'skip'; reason: 'summary' | 'debitPayment' | 'nothingToPay' }
  /** Already imported: its fingerprint is stored (D3). */
  | { kind: 'duplicate' }
  /** "Already logged": the same as a manual entry, merged into it (D3). */
  | { kind: 'merge'; transactionId: string; fillDescription: boolean }
  /** A new charge, refund or fee. `manualMatch` is set when the user unmerged it. */
  | { kind: 'add'; fingerprint: string; fee: boolean; manualMatch?: string }
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
  /** A bill payment against the statement closing on `periodEnd` (D14). */
  | { kind: 'payment'; periodEnd: IsoDate; dueDate: IsoDate; amountDue: number }
  /** A payment already stored (any method), or one auto-pay makes (D14). */
  | { kind: 'paymentRecorded'; reason: 'recorded' | 'autoPay' };

export interface ImportContext {
  card: Card;
  /** Everything already stored for the card. */
  transactions: readonly Transaction[];
  plans: readonly InstallmentPlan[];
  statements: readonly Statement[];
  payments: readonly Payment[];
  overrides: readonly BalanceOverride[];
}

export interface PlannedRow {
  row: DraftRow;
  outcome: RowOutcome;
}

/**
 * Decides what each reviewed row becomes (D3, D16), in file order. Pure: the review
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

  // Charges and plans this import adds, so payments see the bills they create.
  const billing: BillingTotals = { transactions: [], plans: [], payments: [] };

  // Fingerprints are a property of the row's position in the file, so they are counted
  // before drops and merges: re-importing the same file finds the same ones.
  const fingerprints = rows.map((row) => {
    if (!isValid(row)) return '';
    const base = transactionFingerprint(card.id, row.date!, signedAmount(row), row.description);
    const n = (occurrences.get(base) ?? 0) + 1;
    occurrences.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  });

  return rows.map((row, i): PlannedRow => {
    const outcome = decide(row, fingerprints[i] as string);
    return { row, outcome };
  });

  function decide(row: DraftRow, fingerprint: string): RowOutcome {
    if (row.dropped) return { kind: 'dropped' };
    if (row.type === 'summary') return { kind: 'skip', reason: 'summary' };
    if (!row.date) return { kind: 'invalid', problem: 'date' };
    if (!row.amount) return { kind: 'invalid', problem: 'amount' };
    const date = row.date;
    const amount = signedAmount(row);

    if (row.type === 'payment') {
      if (card.type !== 'credit') return { kind: 'skip', reason: 'debitPayment' };
      return decidePayment(date, row.amount);
    }

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
      billing.plans.push({
        id: `new:${row.line}`,
        totalAmount,
        count,
        firstDueMonth: dueMonth,
        currency,
      });
      billing.transactions.push({
        date,
        amount: totalAmount,
        currency,
        installmentPlanId: `new:${row.line}`,
      });
      return { kind: 'newPlan', count, totalAmount, firstDueMonth: dueMonth, fingerprint };
    }

    // Charges, refunds and fees (and slices on a debit card, D13).
    if (imported.has(fingerprint)) return { kind: 'duplicate' };
    const match = manual
      .filter(
        (tx) =>
          !claimedManual.has(tx.id) &&
          tx.amount === amount &&
          Math.abs(daysBetween(tx.date, date)) <= MATCH_WINDOW_DAYS,
      )
      .sort((a, b) => Math.abs(daysBetween(a.date, date)) - Math.abs(daysBetween(b.date, date)))[0];
    if (match && !row.unmerged) {
      claimedManual.add(match.id);
      return { kind: 'merge', transactionId: match.id, fillDescription: !match.description.trim() };
    }
    if (match) claimedManual.add(match.id);
    billing.transactions.push({ date, amount, currency });
    return {
      kind: 'add',
      fingerprint,
      fee: row.type === 'fee',
      ...(match ? { manualMatch: match.id } : {}),
    };
  }

  function decidePayment(date: IsoDate, amount: number): RowOutcome {
    if (card.type !== 'credit') return { kind: 'skip', reason: 'debitPayment' };
    const recorded = context.payments.some(
      (p) =>
        p.currency === currency &&
        p.amount === amount &&
        Math.abs(daysBetween(p.date, date)) <= MATCH_WINDOW_DAYS,
    );
    if (recorded) return { kind: 'paymentRecorded', reason: 'recorded' };

    const input: BillingInput = {
      card,
      transactions: [...context.transactions, ...billing.transactions],
      plans: [...context.plans, ...billing.plans],
      statements: context.statements,
      payments: [...context.payments, ...billing.payments],
      overrides: context.overrides,
    };
    const bill = computeBill(statementPaidBy(date, card), input);

    // Auto-pay settles each bill on its due date (D14): the bank's row is that payment.
    if (
      card.autoPay &&
      card.autoPaySince &&
      bill.dueDate >= card.autoPaySince &&
      Math.abs(daysBetween(bill.dueDate, date)) <= MATCH_WINDOW_DAYS
    ) {
      return { kind: 'paymentRecorded', reason: 'autoPay' };
    }
    if (bill.amountDue <= 0) return { kind: 'skip', reason: 'nothingToPay' };

    // Later payment rows in the file see this one when they pay the same statement.
    const statementId = `new:${bill.periodEnd}`;
    billing.payments.push({ statementId, date, amount, currency, createdAt: '' });
    return {
      kind: 'payment',
      periodEnd: bill.periodEnd,
      dueDate: bill.dueDate,
      amountDue: bill.amountDue,
    };
  }
}

type BillingTotals = {
  transactions: BillingInput['transactions'][number][];
  plans: BillingInput['plans'][number][];
  payments: BillingInput['payments'][number][];
};

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
export function statementPaidBy(date: IsoDate, card: Extract<Card, { type: 'credit' }>) {
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
