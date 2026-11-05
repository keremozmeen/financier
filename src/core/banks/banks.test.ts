import { BANKS, initials, matchBank } from '.';

describe('matchBank', () => {
  it('finds a bank by its name, with Turkish letters folded', () => {
    expect(matchBank('İş Bankası')?.id).toBe('isbank');
    expect(matchBank('IS BANKASI')?.id).toBe('isbank');
    expect(matchBank('Yapı Kredi')?.id).toBe('yapikredi');
    expect(matchBank('VakıfBank')?.id).toBe('vakifbank');
  });

  it('finds a bank by its card brand in the card name', () => {
    expect(matchBank('', 'Axess')?.id).toBe('akbank');
    expect(matchBank(undefined, 'Bonus Platinum')?.id).toBe('garanti');
    expect(matchBank('', 'Maximum Gold')?.id).toBe('isbank');
  });

  it('prefers the bank text over the card name', () => {
    expect(matchBank('Akbank', 'Bonus')?.id).toBe('akbank');
  });

  it('matches whole words only', () => {
    // "ing" is not inside "Ingiltere" or "shopping".
    expect(matchBank('Shopping card')).toBeUndefined();
    expect(matchBank('', 'Test Maaş')).toBeUndefined();
    expect(matchBank('ING')?.id).toBe('ing');
  });

  it('gives every bank a unique id and a mark', () => {
    expect(new Set(BANKS.map((bank) => bank.id)).size).toBe(BANKS.length);
    for (const bank of BANKS) expect(bank.mark.length).toBeGreaterThan(0);
  });
});

describe('initials', () => {
  it('takes the first letter of up to two words, upper-cased the Turkish way', () => {
    expect(initials('ziraat katılım')).toBe('ZK');
    expect(initials('istanbul')).toBe('İ');
    expect(initials('  ')).toBe('');
  });
});
