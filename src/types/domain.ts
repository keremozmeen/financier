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

export interface Card {
  id: string;
  name: string;
  bank: string;
  last4: string;
  currency: CurrencyCode;
  limit: number;
  /** Day of month the statement closes (1–31, clamped to month length). */
  statementDay: number;
  /** Day of month the payment is due (1–31, clamped to month length). */
  dueDay: number;
  color: string;
  archived: boolean;
}

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

export interface Statement {
  id: string;
  cardId: string;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  dueDate: IsoDate;
  totalDue: number;
  minimumDue: number;
  paid: boolean;
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
