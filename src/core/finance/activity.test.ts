import { recentActivity } from './activity';

describe('recentActivity', () => {
  it('lists the newest entries of credit and debit cards together', () => {
    const entries = [
      { id: 'credit-old', cardType: 'credit', date: '2026-10-01' },
      { id: 'debit-new', cardType: 'debit', date: '2026-11-02' },
      { id: 'credit-mid', cardType: 'credit', date: '2026-10-20' },
      { id: 'debit-old', cardType: 'debit', date: '2026-09-15' },
    ];
    expect(recentActivity(entries, 3).map((e) => e.id)).toEqual([
      'debit-new',
      'credit-mid',
      'credit-old',
    ]);
    expect(entries[0]!.id).toBe('credit-old');
  });
});
