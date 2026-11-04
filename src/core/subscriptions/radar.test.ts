import { detectSeries, type RadarTransaction } from './detect';
import { buildRadar, type SubscriptionChoice } from './radar';

const TODAY = '2026-10-20';
let n = 0;

const monthly = (description: string, amounts: number[], patch: Partial<RadarTransaction> = {}) =>
  amounts.map((amount, i): RadarTransaction => {
    const month = 10 - amounts.length + 1 + i;
    return {
      id: `t${++n}`,
      cardId: 'c1',
      date: `2026-${String(month).padStart(2, '0')}-15`,
      description,
      amount,
      currency: 'TRY',
      ...patch,
    };
  });

const choice = (id: string, patch: Partial<SubscriptionChoice> = {}): SubscriptionChoice => ({
  id,
  status: 'active',
  confirmedByUser: true,
  ...patch,
});

const radarOf = (rows: RadarTransaction[], choices: SubscriptionChoice[] = [], today = TODAY) =>
  buildRadar(detectSeries(rows, today), choices);

describe('buildRadar (D19)', () => {
  it('shows a new series as detected and adds it to the totals', () => {
    const radar = radarOf([
      ...monthly('NETFLIX', [22_999, 22_999, 22_999]),
      ...monthly('SPOTIFY', [5_999, 5_999, 5_999]),
      ...monthly('ENERJISA', [40_000, 50_000, 60_000]),
    ]);
    expect(radar.subscriptions.map((s) => [s.merchant, s.state])).toEqual([
      ['netflix', 'detected'],
      ['spotify', 'detected'],
    ]);
    expect(radar.bills.map((s) => s.merchant)).toEqual(['enerjisa']);
    expect(radar.totals).toEqual([
      {
        currency: 'TRY',
        subscriptionsMonthly: 28_998,
        subscriptionsYearly: 347_976,
        billsMonthly: 50_000,
        increasesMonthly: 0,
      },
    ]);
  });

  it('marks a confirmed series and keeps it in the totals', () => {
    const radar = radarOf(monthly('NETFLIX', [22_999, 22_999, 22_999]), [choice('netflix|TRY')]);
    expect(radar.subscriptions[0]?.state).toBe('confirmed');
    expect(radar.totals[0]?.subscriptionsMonthly).toBe(22_999);
  });

  it('hides an ignored series from lists, totals and alerts', () => {
    const radar = radarOf(monthly('NETFLIX', [22_999, 22_999, 23_999]), [
      choice('netflix|TRY', { status: 'ignored', confirmedByUser: false }),
    ]);
    expect(radar.subscriptions).toEqual([]);
    expect(radar.ignored).toHaveLength(1);
    expect(radar.alerts).toEqual([]);
    expect(radar.totals).toEqual([]);
  });

  describe('cancelled', () => {
    it('leaves the totals and stays quiet while no charge follows', () => {
      const radar = radarOf(monthly('NETFLIX', [22_999, 22_999, 22_999]), [
        choice('netflix|TRY', { status: 'cancelled', cancelledAt: '2026-10-15' }),
      ]);
      expect(radar.cancelled).toHaveLength(1);
      expect(radar.subscriptions).toEqual([]);
      expect(radar.alerts).toEqual([]);
    });

    it('alerts on a charge after the cancellation date', () => {
      const radar = radarOf(monthly('NETFLIX', [22_999, 22_999, 22_999]), [
        choice('netflix|TRY', { status: 'cancelled', cancelledAt: '2026-10-01' }),
      ]);
      expect(radar.alerts).toMatchObject([
        { kind: 'afterCancel', charge: { date: '2026-10-15', amount: 22_999 } },
      ]);
    });
  });

  describe('price increases', () => {
    it('alerts until the user acknowledges the new price, and always counts it', () => {
      const rows = monthly('NETFLIX', [22_999, 22_999, 23_999]);
      const fresh = radarOf(rows);
      expect(fresh.alerts).toMatchObject([
        { kind: 'increase', increase: { from: 22_999, to: 23_999 } },
      ]);
      expect(fresh.totals[0]?.increasesMonthly).toBe(1_000);

      const seen = radarOf(rows, [choice('netflix|TRY', { hikeSeenAmount: 23_999 })]);
      expect(seen.alerts).toEqual([]);
      expect(seen.totals[0]?.increasesMonthly).toBe(1_000);
    });

    it('alerts again on a later, higher increase', () => {
      const rows = monthly('NETFLIX', [22_999, 23_999, 24_999]);
      const radar = radarOf(rows, [choice('netflix|TRY', { hikeSeenAmount: 23_999 })]);
      expect(radar.alerts).toMatchObject([{ kind: 'increase', increase: { to: 24_999 } }]);
    });

    it('sums small raises across subscriptions', () => {
      const raised = (name: string) => monthly(name, [10_000, 10_000, 11_000]);
      const radar = radarOf([...raised('EXXEN'), ...raised('BLUTV'), ...raised('GAIN')]);
      expect(radar.totals[0]?.increasesMonthly).toBe(3_000);
      expect(radar.alerts).toHaveLength(3);
    });
  });

  describe('double charges', () => {
    const rows = () => [
      ...monthly('SPOTIFY', [5_999, 5_999, 5_999]),
      { ...monthly('SPOTIFY', [5_999])[0]!, date: '2026-10-17' },
    ];

    it('alerts once per double charge', () => {
      expect(radarOf(rows()).alerts).toMatchObject([{ kind: 'double' }]);
    });

    it('stays quiet once the user says it is not a duplicate', () => {
      const all = rows();
      const second = all[all.length - 1]!.id;
      const radar = radarOf(all, [choice('spotify|TRY', { dismissedDuplicates: [second] })]);
      expect(radar.alerts).toEqual([]);
    });
  });

  it('lists series not charged lately apart, outside the totals', () => {
    const radar = radarOf(monthly('BLUTV', [9_900, 9_900, 9_900]), [], '2026-12-15');
    expect(radar.inactive).toHaveLength(1);
    expect(radar.subscriptions).toEqual([]);
    expect(radar.totals).toEqual([]);
  });

  it('keeps totals per currency', () => {
    const radar = radarOf([
      ...monthly('NETFLIX', [22_999, 22_999, 22_999]),
      ...monthly('GITHUB', [400, 400, 400], { currency: 'USD' }),
    ]);
    expect(radar.totals.map((t) => [t.currency, t.subscriptionsMonthly])).toEqual([
      ['TRY', 22_999],
      ['USD', 400],
    ]);
  });
});
