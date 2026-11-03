import {
  classifyRow,
  isCreditType,
  lowerConfidence,
  parseInstallmentMarker,
  type Confidence,
  type ImportRowType,
  type InstallmentMarker,
} from '../../parsers/common';
import type { ParsedRow } from '../../parsers/csv';
import type { CardType, IsoDate } from '../../types/domain';

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
}

/** Classifies parsed rows into review rows (D16). */
export function draftRows(parsed: readonly ParsedRow[], cardType: CardType): DraftRow[] {
  return parsed.map((row) => {
    const amount = row.amount ?? 0;
    const classified = classifyRow({
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
      confidence: lowerConfidence(classified.confidence, row.guessed ? 'low' : 'high'),
      ...(classified.installment && classified.type === 'installment'
        ? { installment: classified.installment }
        : {}),
      dropped: false,
      unmerged: false,
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

/** The row's amount with its direction: refunds and payments are negative. */
export function signedAmount(row: Pick<DraftRow, 'amount' | 'type'>): number {
  const amount = row.amount ?? 0;
  return isCreditType(row.type) ? -amount : amount;
}
