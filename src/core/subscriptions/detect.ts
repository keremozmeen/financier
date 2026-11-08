import { ACCOUNT_BILL_KEYWORDS, keywordRegex } from '../../parsers/common/keywords';
import { foldText } from '../../parsers/common/text';
import type { CurrencyCode, IsoDate, Transaction } from '../../types/domain';
import { categorize } from '../categories';
import { addDays, addMonths, daysBetween, dayOf, minorUnitDigits, monthOf } from '../finance';
import { displayName, merchantKey } from './merchant';

export type Cadence = 'weekly' | 'monthly' | 'yearly';
export type SeriesKind = 'subscription' | 'bill';

export type RadarTransaction = Pick<
  Transaction,
  'id' | 'cardId' | 'date' | 'description' | 'amount' | 'currency'
> &
  Partial<Pick<Transaction, 'fee' | 'income' | 'bill' | 'transfer' | 'installmentPlanId'>>;

export interface SeriesCharge {
  id: string;
  cardId: string;
  date: IsoDate;
  /** Positive minor units. */
  amount: number;
  description: string;
}

export interface PriceIncrease {
  /** The charge before the increase. */
  from: number;
  to: number;
  date: IsoDate;
  transactionId: string;
  /**
   * Worth a red alert: at least 5 units of the currency (₺5) or 3% (D19). Smaller raises,
   * like ₺0,50 or exchange-rate drift, are shown quietly and still counted in the total.
   */
  notable: boolean;
}

export interface DoubleCharge {
  first: SeriesCharge;
  second: SeriesCharge;
}

/** A repeating charge found by D19, before the user's choices are applied. */
export interface DetectedSeries {
  /** Stable id for the user's choices: `merchant | currency`, plus `#amount` when needed. */
  key: string;
  merchant: string;
  /** A readable name: "Netflix" for "IYZICO *NETFLIX.COM" (D19). */
  name: string;
  /** The latest charge's description, as the bank wrote it. */
  bankText: string;
  currency: CurrencyCode;
  kind: SeriesKind;
  cadence: Cadence;
  /** The run of charges the cadence was found in, oldest first, without double charges. */
  charges: SeriesCharge[];
  latest: SeriesCharge;
  /** The latest amount for a subscription, the average of the last 3 for a bill. */
  amount: number;
  monthly: number;
  yearly: number;
  active: boolean;
  nextDate: IsoDate;
  increase?: PriceIncrease;
  doubles: DoubleCharge[];
}

interface CadenceRule {
  min: number;
  max: number;
  /** Charges needed in the run. */
  charges: number;
  /** Days after the latest charge the series still counts as active. */
  grace: number;
  /** How many of the latest charges an increase stays visible for. */
  increaseWindow: number;
}

export const CADENCES: Record<Cadence, CadenceRule> = {
  weekly: { min: 6, max: 8, charges: 3, grace: 14, increaseWindow: 3 },
  monthly: { min: 25, max: 35, charges: 3, grace: 45, increaseWindow: 3 },
  yearly: { min: 355, max: 375, charges: 2, grace: 400, increaseWindow: 2 },
};

/** A charge joins a series whose latest amount is within this share of it. */
const SERIES_TOLERANCE = 0.35;
/** Same amount again within this many days is a double charge. */
const DOUBLE_DAYS = 3;
/** A refund this many days after a double charge clears it. */
const REFUND_DAYS = 30;
/** An increase must beat this many charges before it. */
const INCREASE_LOOKBACK = 3;
/** A raise is notable (a red alert) from this many units of the currency, or this share. */
const NOTABLE_UNITS = 5;
const NOTABLE_SHARE = 0.03;

/** Whether a raise is worth a red alert (D19): ₺5 or 3% and up. */
export function isNotableIncrease(from: number, to: number, currency: CurrencyCode): boolean {
  const diff = to - from;
  return diff >= NOTABLE_UNITS * 10 ** minorUnitDigits(currency) || diff >= from * NOTABLE_SHARE;
}

const BILL = keywordRegex(ACCOUNT_BILL_KEYWORDS);

/** A charge's cost per month and per year for its cadence, rounded to the minor unit. */
export function cadenceCost(amount: number, cadence: Cadence): { monthly: number; yearly: number } {
  switch (cadence) {
    case 'weekly':
      return { monthly: Math.round((amount * 52) / 12), yearly: amount * 52 };
    case 'monthly':
      return { monthly: amount, yearly: amount * 12 };
    case 'yearly':
      return { monthly: Math.round(amount / 12), yearly: amount };
  }
}

export function nextChargeDate(date: IsoDate, cadence: Cadence): IsoDate {
  const day = Number(date.slice(8, 10));
  switch (cadence) {
    case 'weekly':
      return addDays(date, 7);
    case 'monthly':
      return dayOf(addMonths(monthOf(date), 1), day);
    case 'yearly':
      return dayOf(addMonths(monthOf(date), 12), day);
  }
}

const byDate = (a: SeriesCharge, b: SeriesCharge) =>
  a.date.localeCompare(b.date) || a.id.localeCompare(b.id);

/** Splits one merchant's charges into series by amount (D19); a bill is one series. */
function clusters(charges: readonly SeriesCharge[], bill: boolean): SeriesCharge[][] {
  if (bill) return [[...charges]];
  const result: SeriesCharge[][] = [];
  for (const charge of charges) {
    let best: SeriesCharge[] | undefined;
    let bestGap = Infinity;
    for (const series of result) {
      const last = series[series.length - 1]!.amount;
      const gap = Math.abs(charge.amount - last) / last;
      if (gap <= SERIES_TOLERANCE && gap < bestGap) {
        best = series;
        bestGap = gap;
      }
    }
    if (best) best.push(charge);
    else result.push([charge]);
  }
  return result;
}

/** The same amount again within 3 days is a double charge, left out of the cadence. */
function splitDoubles(charges: readonly SeriesCharge[]) {
  const kept: SeriesCharge[] = [];
  const doubles: DoubleCharge[] = [];
  for (const charge of charges) {
    const previous = kept[kept.length - 1];
    if (
      previous &&
      previous.amount === charge.amount &&
      daysBetween(previous.date, charge.date) <= DOUBLE_DAYS
    ) {
      doubles.push({ first: previous, second: charge });
    } else {
      kept.push(charge);
    }
  }
  return { kept, doubles };
}

/** The longest run of cadence intervals ending at the latest charge, when it is long enough. */
function findCadence(
  charges: readonly SeriesCharge[],
  bill: boolean,
): { cadence: Cadence; run: SeriesCharge[] } | undefined {
  const order: Cadence[] = bill ? ['monthly'] : ['monthly', 'weekly', 'yearly'];
  for (const cadence of order) {
    const rule = CADENCES[cadence];
    let start = charges.length - 1;
    while (start > 0) {
      const gap = daysBetween(charges[start - 1]!.date, charges[start]!.date);
      if (gap < rule.min || gap > rule.max) break;
      start--;
    }
    const run = charges.slice(start);
    if (run.length >= rule.charges) return { cadence, run };
  }
  return undefined;
}

/** The latest increase among the last few charges: higher than each of the 3 before it. */
function findIncrease(
  run: readonly SeriesCharge[],
  cadence: Cadence,
  currency: CurrencyCode,
): PriceIncrease | undefined {
  const oldest = Math.max(1, run.length - CADENCES[cadence].increaseWindow);
  for (let i = run.length - 1; i >= oldest; i--) {
    const charge = run[i]!;
    const before = run.slice(Math.max(0, i - INCREASE_LOOKBACK), i);
    if (before.every((earlier) => charge.amount > earlier.amount)) {
      const from = run[i - 1]!.amount;
      return {
        from,
        to: charge.amount,
        date: charge.date,
        transactionId: charge.id,
        notable: isNotableIncrease(from, charge.amount, currency),
      };
    }
  }
  return undefined;
}

/**
 * Finds subscriptions and bills in the stored transactions (D19), across credit and
 * debit cards. Pure: the user's choices are applied by `buildRadar`.
 */
export function detectSeries(
  transactions: readonly RadarTransaction[],
  today: IsoDate,
): DetectedSeries[] {
  const groups = new Map<
    string,
    { charges: SeriesCharge[]; refunds: SeriesCharge[]; bill: boolean }
  >();
  for (const tx of transactions) {
    if (tx.fee || tx.transfer || tx.income || tx.installmentPlanId || tx.amount === 0) continue;
    // Grocery runs follow what the household needs, however regular they look (D19).
    if (!tx.bill && categorize({ description: tx.description })?.main === 'groceries') continue;
    const merchant = merchantKey(tx.description);
    if (!merchant) continue;
    const id = `${merchant}|${tx.currency}`;
    let group = groups.get(id);
    if (!group) {
      group = { charges: [], refunds: [], bill: false };
      groups.set(id, group);
    }
    const charge: SeriesCharge = {
      id: tx.id,
      cardId: tx.cardId,
      date: tx.date,
      amount: Math.abs(tx.amount),
      description: tx.description.trim(),
    };
    if (tx.amount < 0) {
      group.refunds.push(charge);
    } else {
      group.charges.push(charge);
      if (tx.bill || BILL.test(foldText(tx.description))) group.bill = true;
    }
  }

  const result: DetectedSeries[] = [];
  for (const [groupKey, group] of groups) {
    const [merchant = '', currency = ''] = groupKey.split('|');
    const found: DetectedSeries[] = [];
    for (const cluster of clusters(group.charges.sort(byDate), group.bill)) {
      const { kept, doubles } = splitDoubles(cluster);
      const match = findCadence(kept, group.bill);
      if (!match) continue;
      const { cadence, run } = match;
      const latest = run[run.length - 1]!;
      const lastThree = run.slice(-3);
      const amount = group.bill
        ? Math.round(lastThree.reduce((sum, c) => sum + c.amount, 0) / lastThree.length)
        : latest.amount;
      const increase = group.bill ? undefined : findIncrease(run, cadence, currency);
      found.push({
        key: groupKey,
        merchant,
        name: displayName(latest.description),
        bankText: latest.description,
        currency,
        kind: group.bill ? 'bill' : 'subscription',
        cadence,
        charges: run,
        latest,
        amount,
        ...cadenceCost(amount, cadence),
        active: daysBetween(latest.date, today) <= CADENCES[cadence].grace,
        nextDate: nextChargeDate(latest.date, cadence),
        ...(increase ? { increase } : {}),
        doubles: doubles.filter(
          (double) =>
            double.second.date >= run[0]!.date &&
            !group.refunds.some((refund) => {
              const days = daysBetween(double.second.date, refund.date);
              return refund.amount === double.second.amount && days >= 0 && days <= REFUND_DAYS;
            }),
        ),
      });
    }
    // One merchant billing several subscriptions: tell them apart by their first amount.
    if (found.length > 1) {
      for (const series of found) series.key = `${groupKey}#${series.charges[0]!.amount}`;
    }
    result.push(...found);
  }
  return result;
}
