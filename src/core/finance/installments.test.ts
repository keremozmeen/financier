import { remainingPlanBalance, splitInstallments } from './installments';

describe('splitInstallments', () => {
  it('puts the remainder on the first installment', () => {
    expect(splitInstallments(1000, 3)).toEqual([334, 333, 333]);
    expect(splitInstallments(1_000_001, 6)).toEqual([
      166_671, 166_666, 166_666, 166_666, 166_666, 166_666,
    ]);
  });

  it('splits evenly when possible', () => {
    expect(splitInstallments(1_200_000, 6)).toEqual(Array(6).fill(200_000));
  });

  it('always sums to the total', () => {
    for (const [total, count] of [
      [99_999, 7],
      [1, 1],
      [5, 4],
      [123_456_789, 36],
    ] as const) {
      const parts = splitInstallments(total, count);
      expect(parts).toHaveLength(count);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it('rejects invalid input', () => {
    expect(() => splitInstallments(0, 3)).toThrow(RangeError);
    expect(() => splitInstallments(10.5, 3)).toThrow(RangeError);
    expect(() => splitInstallments(1000, 0)).toThrow(RangeError);
    expect(() => splitInstallments(1000, 37)).toThrow(RangeError);
  });
});

describe('remainingPlanBalance', () => {
  it('is the full total before any payment', () => {
    expect(remainingPlanBalance(1000, 3, 0)).toBe(1000);
  });

  it('drops paid installments, first one included', () => {
    expect(remainingPlanBalance(1000, 3, 1)).toBe(666);
    expect(remainingPlanBalance(1000, 3, 3)).toBe(0);
    expect(remainingPlanBalance(1000, 3, 5)).toBe(0);
  });
});
