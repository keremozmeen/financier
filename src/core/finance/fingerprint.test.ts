import { normalizeDescription, transactionFingerprint } from './fingerprint';

describe('normalizeDescription', () => {
  it('lower-cases, folds accents and strips punctuation', () => {
    expect(normalizeDescription('  MİGROS  Kadıköy *İSTANBUL ')).toBe('migros kadikoy istanbul');
    expect(normalizeDescription('IŞIK-ELEKTRİK, A.Ş.')).toBe('isik elektrik a s');
  });

  it('matches upper-case ASCII statements to Turkish spelling', () => {
    expect(normalizeDescription('MIGROS KADIKOY')).toBe(normalizeDescription('Migros Kadıköy'));
    expect(normalizeDescription('NETFLIX')).toBe(normalizeDescription('Netflix'));
  });
});

describe('transactionFingerprint', () => {
  it('matches the same transaction written differently', () => {
    expect(transactionFingerprint('c1', '2026-11-02', 4500, 'Netflix.com')).toBe(
      transactionFingerprint('c1', '2026-11-02', 4500, '  NETFLIX COM '),
    );
  });

  it('differs when card, date or amount differ', () => {
    const base = transactionFingerprint('c1', '2026-11-02', 4500, 'Netflix');
    expect(transactionFingerprint('c2', '2026-11-02', 4500, 'Netflix')).not.toBe(base);
    expect(transactionFingerprint('c1', '2026-11-03', 4500, 'Netflix')).not.toBe(base);
    expect(transactionFingerprint('c1', '2026-11-02', 4501, 'Netflix')).not.toBe(base);
  });
});
