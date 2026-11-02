import {
  addMonths,
  clampDay,
  daysBetween,
  firstDueMonth,
  formatDate,
  isIsoDate,
  monthOf,
  nextStatementDates,
  todayIso,
} from './dates';

describe('isIsoDate', () => {
  it('accepts real dates only', () => {
    expect(isIsoDate('2026-11-02')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('26.10.2026')).toBe(false);
  });
});

describe('todayIso', () => {
  it('uses the local calendar date', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('daysBetween', () => {
  it('counts whole days across months and DST changes', () => {
    expect(daysBetween('2026-10-01', '2026-11-02')).toBe(32);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-11-02', '2026-11-01')).toBe(-1);
  });
});

describe('months', () => {
  it('adds months across years', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthOf('2026-11-02')).toBe('2026-11');
  });

  it('clamps day settings to the month length', () => {
    expect(clampDay('2026-02', 31)).toBe(28);
    expect(clampDay('2026-04', 31)).toBe(30);
    expect(clampDay('2026-05', 15)).toBe(15);
  });
});

describe('firstDueMonth', () => {
  // Statement closes on the 10th, due on the 20th of the same month.
  it('uses the current statement up to and including the closing day', () => {
    expect(firstDueMonth('2026-11-10', 10, 20)).toBe('2026-11');
    expect(firstDueMonth('2026-11-11', 10, 20)).toBe('2026-12');
  });

  // Statement closes on the 25th, due on the 5th of the next month.
  it('moves to the next month when the due day comes before the closing day', () => {
    expect(firstDueMonth('2026-11-20', 25, 5)).toBe('2026-12');
    expect(firstDueMonth('2026-11-26', 25, 5)).toBe('2027-01');
  });

  it('handles a closing day past the end of a short month', () => {
    expect(firstDueMonth('2026-02-28', 31, 10)).toBe('2026-03');
  });
});

describe('nextStatementDates', () => {
  it('uses this month when the closing day has not passed, including today', () => {
    expect(nextStatementDates('2026-11-02', 10, 20)).toEqual({
      statementDate: '2026-11-10',
      dueDate: '2026-11-20',
    });
    expect(nextStatementDates('2026-11-10', 10, 20)).toMatchObject({ statementDate: '2026-11-10' });
  });

  it('moves to next month once the closing day has passed', () => {
    expect(nextStatementDates('2026-11-11', 10, 20)).toEqual({
      statementDate: '2026-12-10',
      dueDate: '2026-12-20',
    });
  });

  it('puts the due date in the next month when it comes before the closing day', () => {
    expect(nextStatementDates('2026-11-02', 25, 5)).toEqual({
      statementDate: '2026-11-25',
      dueDate: '2026-12-05',
    });
    expect(nextStatementDates('2026-12-26', 25, 5)).toEqual({
      statementDate: '2027-01-25',
      dueDate: '2027-02-05',
    });
  });

  it('puts equal days one month apart', () => {
    expect(nextStatementDates('2026-11-02', 15, 15)).toEqual({
      statementDate: '2026-11-15',
      dueDate: '2026-12-15',
    });
  });

  it('clamps a 31st to the last day of a 30-day month', () => {
    expect(nextStatementDates('2026-11-02', 31, 10)).toEqual({
      statementDate: '2026-11-30',
      dueDate: '2026-12-10',
    });
    // Due on the 31st, after a closing in a 30-day month.
    expect(nextStatementDates('2026-04-02', 20, 31)).toEqual({
      statementDate: '2026-04-20',
      dueDate: '2026-04-30',
    });
  });

  it('clamps to February in common and leap years', () => {
    expect(nextStatementDates('2026-02-10', 31, 10)).toEqual({
      statementDate: '2026-02-28',
      dueDate: '2026-03-10',
    });
    expect(nextStatementDates('2028-02-10', 30, 10)).toMatchObject({
      statementDate: '2028-02-29',
    });
    // Closing on the 15th in January, due on the 31st → February's last day.
    expect(nextStatementDates('2027-01-20', 15, 31)).toEqual({
      statementDate: '2027-02-15',
      dueDate: '2027-02-28',
    });
  });

  it('treats the last day of February as the clamped closing day', () => {
    // On 28 Feb 2026 a 31st closing day closes today, not in March.
    expect(nextStatementDates('2026-02-28', 31, 10)).toMatchObject({
      statementDate: '2026-02-28',
    });
  });
});

describe('formatDate', () => {
  it('formats per locale without time-zone shifts', () => {
    expect(formatDate('2026-11-02', 'tr')).toBe('2 Kas 2026');
    expect(formatDate('2026-11-02', 'en')).toBe('Nov 2, 2026');
  });
});
