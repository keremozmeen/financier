// Domain types for the v1 data model (DECISIONS.md "Data model").
// Amounts are integers in minor units (D2); dates are ISO YYYY-MM-DD strings.

/** ISO 4217 currency code, e.g. "TRY". */
export type CurrencyCode = string;
/** Calendar date as YYYY-MM-DD. */
export type IsoDate = string;
/** Calendar month as YYYY-MM. */
export type IsoMonth = string;
/** Instant as an ISO 8601 timestamp, e.g. from Date#toISOString. */
export type IsoTimestamp = string;

export type TransactionSource = 'manual' | 'csv' | 'pdf';

export type CardType = 'credit' | 'debit';

interface CardBase {
  id: string;
  name: string;
  bank: string;
  last4: string;
  currency: CurrencyCode;
  color: string;
  archived: boolean;
}

/** Kredi kartı: has a limit and a monthly statement (D11, D12). */
export interface CreditCard extends CardBase {
  type: 'credit';
  limit: number;
  /** Day of month the statement closes (1–31, clamped to month length). */
  statementDay: number;
  /** Day of month the payment is due (1–31, clamped to month length). */
  dueDay: number;
}

/** Banka kartı: spends straight from an account whose balance the app does not know (D13). */
export interface DebitCard extends CardBase {
  type: 'debit';
}

export type Card = CreditCard | DebitCard;

export interface Transaction {
  id: string;
  cardId: string;
  date: IsoDate;
  description: string;
  normalizedMerchant: string;
  /** Positive for a charge, negative for a refund. */
  amount: number;
  currency: CurrencyCode;
  category: string;
  installmentPlanId?: string;
  fingerprint: string;
  source: TransactionSource;
  importId?: string;
}

export interface InstallmentPlan {
  id: string;
  cardId: string;
  description: string;
  totalAmount: number;
  count: number;
  purchaseDate: IsoDate;
  firstDueMonth: IsoMonth;
  currency: CurrencyCode;
}

export interface BalanceOverride {
  id: string;
  cardId: string;
  balance: number;
  currency: CurrencyCode;
  asOf: IsoDate;
  createdAt: IsoTimestamp;
}

/** One installment of a plan, billed in the statement due in `dueMonth`. */
export interface InstallmentRef {
  planId: string;
  /** 0-based position in the plan. */
  index: number;
  amount: number;
}

/**
 * A credit card statement. Statements are computed from the data and stored only
 * when the user records a payment (D14); the stored row is a snapshot of the bill.
 */
export interface Statement {
  id: string;
  cardId: string;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  /** The due date shown to the user, moved off weekends. */
  dueDate: IsoDate;
  totalDue: number;
  /** Not known yet; imports may read it from the bank statement in later phases. */
  minimumDue?: number;
  /** Fully paid: its installments count as paid and stop blocking the limit (D14). */
  paid: boolean;
  /** The installments billed in this statement. */
  installments: InstallmentRef[];
}

/**
 * How a payment was recorded (D14): entered in the form, or "Paid outside the app"
 * for an overdue bill (the full remaining amount, dated on its due date).
 */
export type PaymentMethod = 'manual' | 'outside';

/** A bill payment towards one statement (D14). Credit cards only. */
export interface Payment {
  id: string;
  cardId: string;
  statementId: string;
  date: IsoDate;
  /** Positive minor units. */
  amount: number;
  currency: CurrencyCode;
  createdAt: IsoTimestamp;
  /** Missing on payments saved before methods existed: those are manual. */
  method?: PaymentMethod;
}

export type SubscriptionStatus = 'active' | 'ignored' | 'cancelled';

export interface Subscription {
  id: string;
  normalizedMerchant: string;
  cadenceDays: number;
  lastAmount: number;
  previousAmount: number;
  status: SubscriptionStatus;
  confirmedByUser: boolean;
}

export interface ImportProfile {
  id: string;
  name: string;
  bank: string;
  kind: 'csv' | 'pdf';
  headerSignature: string;
  columnMap: Record<string, string>;
}

export interface ImportRecord {
  id: string;
  fileName: string;
  importedAt: IsoTimestamp;
  rowCount: number;
  profileId?: string;
}

export interface SettingRow {
  key: string;
  value: unknown;
}
