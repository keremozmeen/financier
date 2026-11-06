import {
  classifyAccountRow,
  classifyRow,
  isCreditType,
  lowerConfidence,
  parseInstallmentMarker,
  type Confidence,
  type ImportRowType,
  type InstallmentMarker,
} from '../../parsers/common';
import type { ParsedRow } from '../../parsers/csv';
import type { CardType, IsoDate, StatementKind } from '../../types/domain';

/** One row on the review screen, as the user left it. */
export interface DraftRow {
  /** 1-based row in the file. */
  line: number;
  date: IsoDate | null;
  description: string;
  /** Positive minor units; the type decides the direction. Null when unreadable. */
  amount: number | null;
  type: ImportRowType;
  confidence: Confidence;
  installment?: InstallmentMarker;
  /** The user left this row out. */
  dropped: boolean;
  /** The user said this row is not the manual entry it matched (D3). */
  unmerged: boolean;
  /** The bank's "Referans" for the row: its fingerprint when present (D17). */
  reference?: string;
  /** The credit card a bill payment from the account paid, as picked by the user (D17). */
  targetCardId?: string;
  /** An outgoing transfer or ATM withdrawal the user counts as spending (D17). */
  countAsSpending?: boolean;
}

/** Classifies parsed rows into review rows: card statements per D16, account statements per D17. */
export function draftRows(
  parsed: readonly ParsedRow[],
  cardType: CardType,
  kind: StatementKind = 'card',
): DraftRow[] {
  return parsed.map((row) => {
    const amount = row.amount ?? 0;
    const classified =
      kind === 'account'
        ? classifyAccountRow({
            description: row.description,
            amount,
            ...(row.labels ? { labels: row.labels } : {}),
          })
        : classifyRow({
            description: row.description,
            amount,
            cardType,
            ...(row.installmentColumn ? { installmentColumn: row.installmentColumn } : {}),
          });
    return {
      line: row.line,
      date: row.date,
      description: row.description,
      amount: row.amount === null ? null : Math.abs(row.amount),
      type: classified.type,
      // A zero amount (a card hold) is skipped whatever its type, so there is nothing to check.
      confidence:
        row.amount === 0
          ? 'high'
          : lowerConfidence(classified.confidence, row.guessed ? 'low' : 'high'),
      ...(classified.installment && classified.type === 'installment'
        ? { installment: classified.installment }
        : {}),
      dropped: false,
      unmerged: false,
      ...(row.reference ? { reference: row.reference } : {}),
    };
  });
}

/**
 * Applies an edit from the review screen. Choosing "installment" reads the marker from
 * the description when the row has none yet.
 */
export function editDraft(row: DraftRow, patch: Partial<DraftRow>): DraftRow {
  const next = { ...row, ...patch };
  if (next.type === 'installment' && !next.installment) {
    const marker = parseInstallmentMarker(next.description);
    if (marker) next.installment = marker;
  }
  return next;
}

/**
 * The row's amount as one entry on screen, with the stored sign (money in is negative)
 * for `formatEntryAmount`. Only refunds and income read as money in. A payment's
 * direction depends on the card (it lowers a credit card's debt but leaves a debit
 * account), so it is shown plain like every other row, and its outcome line says what it pays.
 */
export function reviewAmount(row: Pick<DraftRow, 'amount' | 'type'>): number {
  const amount = row.amount ?? 0;
  return row.type === 'refund' || row.type === 'income' ? -amount : amount;
}

/** The row's amount with its direction: money in (refunds, payments, income) is negative. */
export function signedAmount(row: Pick<DraftRow, 'amount' | 'type'>): number {
  const amount = row.amount ?? 0;
  return isCreditType(row.type) ? -amount : amount;
}
