import { checkSpendAllowed } from './spend';
import type { CardUsageInput } from './usage';

const TL = (lira: number) => lira * 100;

// Limit 10,000 ₺ with 7,000 ₺ already used: 3,000 ₺ available.
const input: CardUsageInput = {
  card: { limit: TL(10_000), currency: 'TRY' },
  transactions: [
    { id: 'coffee', date: '2026-10-01', amount: TL(1_000), currency: 'TRY' },
    {
      id: 'phone',
      date: '2026-10-05',
      amount: TL(6_000),
      currency: 'TRY',
      installmentPlanId: 'phone-plan',
    },
  ],
  plans: [
    {
      id: 'phone-plan',
      purchaseDate: '2026-10-05',
      totalAmount: TL(6_000),
      count: 6,
      currency: 'TRY',
    },
  ],
  overrides: [],
  today: '2026-11-02',
};

describe('checkSpendAllowed', () => {
  it('allows a charge exactly equal to the available limit', () => {
    expect(checkSpendAllowed(input, { kind: 'charge', amount: TL(3_000) })).toEqual({
      allowed: true,
    });
  });

  it('blocks a charge one kuruş over the available limit and reports what is available', () => {
    expect(checkSpendAllowed(input, { kind: 'charge', amount: TL(3_000) + 1 })).toEqual({
      allowed: false,
      available: TL(3_000),
    });
  });

  it('checks an installment purchase by its full total, not one installment', () => {
    // 6 × 600 ₺: each installment fits, but the bank blocks all 3,600 ₺.
    expect(checkSpendAllowed(input, { kind: 'charge', amount: TL(3_600) })).toMatchObject({
      allowed: false,
    });
  });

  it('never blocks refunds, even on a full card', () => {
    const full = { ...input, card: { ...input.card, limit: TL(5_000) } };
    expect(checkSpendAllowed(full, { kind: 'refund', amount: TL(50_000) })).toEqual({
      allowed: true,
    });
  });

  it('blocks every charge on a card that is already over its limit', () => {
    const full = { ...input, card: { ...input.card, limit: TL(5_000) } };
    expect(checkSpendAllowed(full, { kind: 'charge', amount: 1 })).toEqual({
      allowed: false,
      available: 0,
    });
  });

  describe('editing an existing entry', () => {
    it('checks a single charge against the limit available without it', () => {
      // Without the 1,000 ₺ coffee, 4,000 ₺ is available.
      expect(checkSpendAllowed(input, { kind: 'charge', amount: TL(4_000) }, 'coffee')).toEqual({
        allowed: true,
      });
      expect(checkSpendAllowed(input, { kind: 'charge', amount: TL(4_000) + 1 }, 'coffee')).toEqual(
        { allowed: false, available: TL(4_000) },
      );
    });

    it('leaves out the installment plan of an edited installment purchase', () => {
      // Without the 6,000 ₺ phone plan, 9,000 ₺ is available.
      expect(checkSpendAllowed(input, { kind: 'charge', amount: TL(9_000) }, 'phone')).toEqual({
        allowed: true,
      });
      expect(
        checkSpendAllowed(input, { kind: 'charge', amount: TL(9_000) + 1 }, 'phone'),
      ).toMatchObject({ allowed: false, available: TL(9_000) });
    });

    it('ignores an unknown id', () => {
      expect(
        checkSpendAllowed(input, { kind: 'charge', amount: TL(3_001) }, 'missing'),
      ).toMatchObject({ allowed: false });
    });
  });
});
