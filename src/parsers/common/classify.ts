import type { CardType } from '../../types/domain';
import {
  parseInstallmentColumn,
  parseInstallmentMarker,
  type InstallmentMarker,
} from './installments';
import {
  FEE_KEYWORDS,
  keywordRegex,
  PAYMENT_KEYWORDS,
  REFUND_KEYWORDS,
  SUMMARY_KEYWORDS,
} from './keywords';
import { foldText } from './text';

/** What an imported row is (D16). */
export type ImportRowType = 'charge' | 'refund' | 'installment' | 'payment' | 'summary' | 'fee';

export type Confidence = 'high' | 'medium' | 'low';

export interface Classification {
  type: ImportRowType;
  confidence: Confidence;
  /** Set for installment slices, and when a marker was seen on a debit card. */
  installment?: InstallmentMarker;
}

export interface ClassifyInput {
  description: string;
  /** Signed minor units: positive is a charge, negative a credit to the card. */
  amount: number;
  /** The mapped installment column, when the file has one. */
  installmentColumn?: string;
  cardType: CardType;
}

const SUMMARY = keywordRegex(SUMMARY_KEYWORDS);
const PAYMENT = keywordRegex(PAYMENT_KEYWORDS);
const REFUND = keywordRegex(REFUND_KEYWORDS);
const FEE = keywordRegex(FEE_KEYWORDS);

/**
 * Classifies one imported row (D16). Summary lines are checked first, so "ASGARİ ÖDEME
 * TUTARI" is not a payment. A credit row is a refund when it says so, else a bill
 * payment when it has a payment keyword, else a refund with medium confidence. A charge
 * row is a fee when it has a fee keyword, else an installment slice when it carries a
 * marker (credit cards only), else a charge.
 */
export function classifyRow(input: ClassifyInput): Classification {
  const text = foldText(input.description);
  if (SUMMARY.test(text)) return { type: 'summary', confidence: 'high' };

  if (input.amount < 0) {
    if (REFUND.test(text)) return { type: 'refund', confidence: 'high' };
    if (PAYMENT.test(text)) return { type: 'payment', confidence: 'high' };
    return { type: 'refund', confidence: 'medium' };
  }

  if (FEE.test(text)) return { type: 'fee', confidence: 'high' };

  const column = input.installmentColumn ? parseInstallmentColumn(input.installmentColumn) : null;
  const marker = column ?? parseInstallmentMarker(input.description);
  if (marker) {
    // Debit cards have no installments (D13): the slice is a plain charge.
    if (input.cardType === 'debit') {
      return { type: 'charge', confidence: 'high', installment: marker };
    }
    return {
      type: 'installment',
      confidence: marker.keyword ? 'high' : 'medium',
      installment: marker,
    };
  }

  // A payment keyword on a charge is a merchant name ("IYZICO ÖDEME …"), or the sign
  // convention is wrong, so the user should look at it.
  if (PAYMENT.test(text)) return { type: 'charge', confidence: 'medium' };
  return { type: 'charge', confidence: 'high' };
}

/** The types the review screen offers for a card: no installments on debit cards (D13). */
export function rowTypesFor(cardType: CardType): ImportRowType[] {
  return cardType === 'credit'
    ? ['charge', 'refund', 'installment', 'payment', 'fee', 'summary']
    : ['charge', 'refund', 'payment', 'fee', 'summary'];
}

/** Whether the row's amount is a credit to the card (refund or payment) for its type. */
export function isCreditType(type: ImportRowType): boolean {
  return type === 'refund' || type === 'payment';
}

export function lowerConfidence(a: Confidence, b: Confidence): Confidence {
  const rank: Record<Confidence, number> = { high: 2, medium: 1, low: 0 };
  return rank[a] <= rank[b] ? a : b;
}
