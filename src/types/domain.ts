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
  /**
   * Day of month the statement closes (1–31, clamped to month length). Missing until the
   * user enters it or the first imported statement states it; the card has no bills
   * until both days are known (D20).
   */
  statementDay?: number;
  /** Day of month the payment is due (1–31, clamped to month length). Missing as above. */
  dueDay?: number;
  /** The bank pays each statement in full on its due date (D14). */
  autoPay?: boolean;
  /** When auto-pay was turned on; bills due before it are not paid automatically. */
  autoPaySince?: IsoDate;
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
  /** Interest or a bank fee (D16), so fees can be reported. */
  fee?: boolean;
  /**
   * Money received on a bank account: salary, incoming EFT/Havale/FAST (D17). Stored with a
   * negative amount, like a refund, but never counted in spending.
   */
  income?: boolean;
  /** An automatic utility or phone bill paid from the account (D17), for Sub-Radar. */
  bill?: boolean;
  /** An outgoing transfer or ATM withdrawal the user chose to count as spending (D17). */
  transfer?: boolean;
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
  /** Created by an import for a slice with no plan yet; undo removes it (D16). */
  importId?: string;
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
  /** The user deleted this statement's automatic payment: auto-pay leaves it alone. */
  autoPaySkipped?: boolean;
}

/**
 * How a payment was recorded (D14): entered in the form, "Paid outside the app" for an
 * overdue bill, or by auto-pay (both: the full remaining amount, dated on the due date).
 */
export type PaymentMethod = 'manual' | 'outside' | 'automatic';

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
  /** Recorded by an import from a bill payment row; undo removes it (D16). */
  importId?: string;
}

export type SubscriptionStatus = 'active' | 'ignored' | 'cancelled';

/**
 * The user's Sub-Radar choice for one detected series (D19). Series, cadence and amounts
 * are computed from transactions; only this is stored.
 */
export interface Subscription {
  /** The series key: `merchant | currency`, plus `#amount` when one merchant has several. */
  id: string;
  normalizedMerchant: string;
  currency: CurrencyCode;
  status: SubscriptionStatus;
  /** Set when marked cancelled; a charge after it raises an alert. */
  cancelledAt?: IsoDate;
  /** The increased price the user acknowledged ("Got it"). */
  hikeSeenAmount?: number;
  /** Double charges the user said are fine, by the second charge's transaction id. */
  dismissedDuplicates?: string[];
}

/** Settings that tell the CSV reader how a bank formats its export (D3). */
export interface ImportOptions {
  /** 0-based index of the header row among the non-empty rows. */
  headerRow: number;
  decimal: ',' | '.';
  dateOrder: 'DMY' | 'MDY' | 'YMD';
  chargeSign: 'positive' | 'negative';
}

/** A card statement (D16) or a bank account statement, hesap hareketleri (D17). */
export type StatementKind = 'card' | 'account';

export interface ImportProfile {
  id: string;
  name: string;
  bank: string;
  kind: 'csv' | 'pdf';
  headerSignature: string;
  /** Field ("date", "description", "amount", "debit", "credit", "installment") → column index. */
  columnMap: Record<string, string>;
  options: ImportOptions;
}

/** What an import did, per D16 outcome, for the history list. */
export interface ImportRecordCounts {
  transactions: number;
  plans: number;
  payments: number;
  merged: number;
  linked: number;
  skipped: number;
}

export interface ImportRecord {
  id: string;
  fileName: string;
  importedAt: IsoTimestamp;
  rowCount: number;
  profileId?: string;
  cardId: string;
  counts: ImportRecordCounts;
  /** Descriptions the import filled in, put back on undo (D16). */
  restore: {
    transactions: {
      id: string;
      description: string;
      normalizedMerchant: string;
      fingerprint: string;
    }[];
    plans: { id: string; description: string }[];
  };
}

export interface SettingRow {
  key: string;
  value: unknown;
}
