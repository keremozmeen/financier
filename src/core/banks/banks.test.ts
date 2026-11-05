import { BANKS, matchBank } from '.';

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

describe('every bank on the list (D21)', () => {
  it.each(BANKS.map((bank) => [bank.name, bank] as const))(
    'is found by its own name: %s',
    (name, bank) => {
      expect(matchBank(name)?.id).toBe(bank.id);
      expect(matchBank(name.toLocaleUpperCase('tr'))?.id).toBe(bank.id);
    },
  );

  it.each([
    ['Bonus', 'garanti'],
    ['World', 'yapikredi'],
    ['Maximum', 'isbank'],
    ['Axess', 'akbank'],
    ['Wings', 'akbank'],
    ['CardFinans', 'qnb'],
    ['Bankkart', 'ziraat'],
    ['Paraf', 'halkbank'],
    ['Advantage', 'hsbc'],
  ])('is found by its card brand: %s', (brand, id) => {
    expect(matchBank('', `${brand} Platinum`)?.id).toBe(id);
  });
});
