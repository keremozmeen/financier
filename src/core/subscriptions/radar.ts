import type { CurrencyCode, Subscription } from '../../types/domain';
import {
  cadenceCost,
  type DetectedSeries,
  type DoubleCharge,
  type PriceIncrease,
  type SeriesCharge,
} from './detect';

/** How a series looks to the user (D19): no stored choice means "detected". */
export type RadarState = 'detected' | 'confirmed' | 'ignored' | 'cancelled';

export type SubscriptionChoice = Pick<
  Subscription,
  'status' | 'confirmedByUser' | 'cancelledAt' | 'hikeSeenAmount' | 'dismissedDuplicates'
> & { id: string };

export interface RadarItem extends DetectedSeries {
  state: RadarState;
}

export type RadarAlert =
  | { kind: 'increase'; item: RadarItem; increase: PriceIncrease }
  | { kind: 'double'; item: RadarItem; double: DoubleCharge }
  | { kind: 'afterCancel'; item: RadarItem; charge: SeriesCharge };

export interface RadarTotals {
  currency: CurrencyCode;
  subscriptionsMonthly: number;
  subscriptionsYearly: number;
  billsMonthly: number;
  /** Monthly cost of every current price increase (D19), acknowledged or not. */
  increasesMonthly: number;
}

export interface Radar {
  /** Active subscriptions, most expensive per month first. */
  subscriptions: RadarItem[];
  bills: RadarItem[];
  /** Detected or confirmed, but not charged lately. */
  inactive: RadarItem[];
  cancelled: RadarItem[];
  ignored: RadarItem[];
  alerts: RadarAlert[];
  totals: RadarTotals[];
}

function stateOf(choice: SubscriptionChoice | undefined): RadarState {
  if (!choice) return 'detected';
  if (choice.status === 'ignored') return 'ignored';
  if (choice.status === 'cancelled') return 'cancelled';
  return choice.confirmedByUser ? 'confirmed' : 'detected';
}

const byMonthly = (a: RadarItem, b: RadarItem) =>
  b.monthly - a.monthly || a.name.localeCompare(b.name);

/** Applies the user's stored choices to the detected series (D19). */
export function buildRadar(
  series: readonly DetectedSeries[],
  choices: readonly SubscriptionChoice[],
): Radar {
  const byId = new Map(choices.map((choice) => [choice.id, choice]));
  const radar: Radar = {
    subscriptions: [],
    bills: [],
    inactive: [],
    cancelled: [],
    ignored: [],
    alerts: [],
    totals: [],
  };
  const totals = new Map<CurrencyCode, RadarTotals>();
  const totalsFor = (currency: CurrencyCode) => {
    let entry = totals.get(currency);
    if (!entry) {
      entry = {
        currency,
        subscriptionsMonthly: 0,
        subscriptionsYearly: 0,
        billsMonthly: 0,
        increasesMonthly: 0,
      };
      totals.set(currency, entry);
    }
    return entry;
  };

  const increases: RadarAlert[] = [];
  const doubles: RadarAlert[] = [];
  const afterCancel: RadarAlert[] = [];

  for (const detected of series) {
    const choice = byId.get(detected.key);
    const item: RadarItem = { ...detected, state: stateOf(choice) };

    if (item.state === 'ignored') {
      radar.ignored.push(item);
      continue;
    }
    if (item.state === 'cancelled') {
      radar.cancelled.push(item);
      const since = choice?.cancelledAt;
      if (since && item.latest.date > since) {
        afterCancel.push({ kind: 'afterCancel', item, charge: item.latest });
      }
      continue;
    }

    const dismissed = new Set(choice?.dismissedDuplicates ?? []);
    for (const double of item.doubles) {
      if (!dismissed.has(double.second.id)) doubles.push({ kind: 'double', item, double });
    }

    if (!item.active) {
      radar.inactive.push(item);
      continue;
    }

    const sum = totalsFor(item.currency);
    if (item.kind === 'bill') {
      radar.bills.push(item);
      sum.billsMonthly += item.monthly;
      continue;
    }
    radar.subscriptions.push(item);
    sum.subscriptionsMonthly += item.monthly;
    sum.subscriptionsYearly += item.yearly;
    if (item.increase) {
      const { from, to } = item.increase;
      sum.increasesMonthly += cadenceCost(to - from, item.cadence).monthly;
      if ((choice?.hikeSeenAmount ?? 0) < to) {
        increases.push({ kind: 'increase', item, increase: item.increase });
      }
    }
  }

  radar.subscriptions.sort(byMonthly);
  radar.bills.sort(byMonthly);
  radar.inactive.sort(byMonthly);
  radar.cancelled.sort(byMonthly);
  radar.ignored.sort(byMonthly);
  radar.alerts = [...increases, ...doubles, ...afterCancel];
  radar.totals = [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
  return radar;
}
