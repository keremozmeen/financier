import type { CardType, StatementKind } from '../../types/domain';
import {
  parseInstallmentColumn,
  parseInstallmentMarker,
  type InstallmentMarker,
} from './installments';
import {
  ACCOUNT_BILL_KEYWORDS,
  ACCOUNT_INCOME_KEYWORDS,
  ACCOUNT_PURCHASE_KEYWORDS,
  ACCOUNT_TRANSFER_KEYWORDS,
  CARD_PAYMENT_KEYWORDS,
  FEE_KEYWORDS,
  keywordRegex,
  PAYMENT_KEYWORDS,
  REFUND_KEYWORDS,
  SUMMARY_KEYWORDS,
} from './keywords';
import { foldText } from './text';

/** What an imported row is (D16). */
export type ImportRowType =
  | 'charge'
  | 'refund'
  | 'installment'
  | 'payment'
  | 'summary'
  | 'fee'
  /** Account statements (D17): money received, never a refund or spending. */
  | 'income'
  /** Account statements (D17): outgoing transfer or ATM withdrawal, skipped by default. */
  | 'transfer'
  /** Account statements (D17): an automatic utility or phone bill, a charge marked as a bill. */
  | 'bill';

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
const CARD_PAYMENT = keywordRegex(CARD_PAYMENT_KEYWORDS);
const PURCHASE = keywordRegex(ACCOUNT_PURCHASE_KEYWORDS);
const INCOME = keywordRegex(ACCOUNT_INCOME_KEYWORDS);
const TRANSFER = keywordRegex(ACCOUNT_TRANSFER_KEYWORDS);
const BILL = keywordRegex(ACCOUNT_BILL_KEYWORDS);

/**
 * Classifies one imported row (D16). Summary lines are checked first, so "ASGARİ ÖDEME
 * TUTARI" is not a payment. A credit row is a refund when it says so, else a bill
 * payment when it has a payment keyword. On a debit card, money in is otherwise income
 * (high confidence for salary or an incoming transfer, medium without a keyword), as in
 * D17; on a credit card it is a refund with medium confidence. On a debit card, a
 * "KREDİ KARTI ÖDEMESİ" outflow is a payment too. A charge row is a fee when it has a
 * fee keyword, else an installment slice when it carries a marker (credit cards only),
 * else a charge.
 */
export function classifyRow(input: ClassifyInput): Classification {
  const text = foldText(input.description);
  if (SUMMARY.test(text)) return { type: 'summary', confidence: 'high' };

  if (input.amount < 0) {
    if (REFUND.test(text)) return { type: 'refund', confidence: 'high' };
    if (input.cardType === 'debit') {
      if (INCOME.test(text) || TRANSFER.test(text)) return { type: 'income', confidence: 'high' };
      if (PAYMENT.test(text)) return { type: 'payment', confidence: 'high' };
      return { type: 'income', confidence: 'medium' };
    }
    if (PAYMENT.test(text)) return { type: 'payment', confidence: 'high' };
    return { type: 'refund', confidence: 'medium' };
  }

  // On a debit card, paying a credit card bill is an outflow: skip it, the credit card
  // already counts that spending (D16).
  if (input.cardType === 'debit' && CARD_PAYMENT.test(text)) {
    return { type: 'payment', confidence: 'high' };
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

export interface ClassifyAccountInput {
  description: string;
  /** "İşlem Türü", then "İşlem": checked before the description. */
  labels?: readonly string[];
  /** Signed minor units: positive is money going out of the account. */
  amount: number;
}

/**
 * Classifies a bank account statement row (D17). Each text is tried in order (the bank's
 * labels, then the description), and the first one a rule recognizes decides. Money
 * going out: a credit card bill payment, an automatic bill, a fee, an outgoing transfer
 * or ATM withdrawal, else a purchase. Money coming in: a refund when it says so, else
 * income.
 */
export function classifyAccountRow(input: ClassifyAccountInput): Classification {
  const texts = [...(input.labels ?? []), input.description].map(foldText).filter(Boolean);
  if (texts.some((text) => SUMMARY.test(text))) return { type: 'summary', confidence: 'high' };

  if (input.amount < 0) {
    for (const text of texts) {
      if (REFUND.test(text)) return { type: 'refund', confidence: 'high' };
      if (INCOME.test(text) || TRANSFER.test(text)) return { type: 'income', confidence: 'high' };
    }
    return { type: 'income', confidence: 'medium' };
  }

  for (const text of texts) {
    if (CARD_PAYMENT.test(text)) return { type: 'payment', confidence: 'high' };
    if (BILL.test(text)) return { type: 'bill', confidence: 'high' };
    if (FEE.test(text)) return { type: 'fee', confidence: 'high' };
    if (TRANSFER.test(text)) return { type: 'transfer', confidence: 'high' };
    if (PURCHASE.test(text)) return { type: 'charge', confidence: 'high' };
  }
  return { type: 'charge', confidence: 'medium' };
}

/**
 * The types the review screen offers: no installments on debit cards (D13), income only
 * on debit cards and account statements, transfers and bills only on account statements
 * (D17).
 */
export function rowTypesFor(cardType: CardType, kind: StatementKind = 'card'): ImportRowType[] {
  if (kind === 'account') {
    return ['charge', 'income', 'refund', 'bill', 'payment', 'transfer', 'fee', 'summary'];
  }
  return cardType === 'credit'
    ? ['charge', 'refund', 'installment', 'payment', 'fee', 'summary']
    : ['charge', 'income', 'refund', 'payment', 'fee', 'summary'];
}

/** Whether the row's amount is money in (refund, payment to the card, income) for its type. */
export function isCreditType(type: ImportRowType): boolean {
  return type === 'refund' || type === 'payment' || type === 'income';
}

export function lowerConfidence(a: Confidence, b: Confidence): Confidence {
  const rank: Record<Confidence, number> = { high: 2, medium: 1, low: 0 };
  return rank[a] <= rank[b] ? a : b;
}
