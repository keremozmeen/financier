import { BRAND_PHRASES } from './brands';
import { categorize } from './categorize';
import { parseCategory, categoryPath, MAIN_CATEGORY_IDS } from './categories';

const path = (description: string) => {
  const result = categorize({ description });
  return result && categoryPath(result);
};

describe('category list (D22)', () => {
  it('has the agreed main categories', () => {
    expect(MAIN_CATEGORY_IDS).toEqual([
      'groceries',
      'eating-out',
      'transport',
      'bills',
      'subscriptions',
      'shopping',
      'health',
      'entertainment',
      'travel',
      'education',
      'cash',
      'fees',
      'other',
    ]);
  });

  it('reads stored values and rejects anything else', () => {
    expect(parseCategory('transport/fuel')).toEqual({ main: 'transport', sub: 'fuel' });
    expect(parseCategory('transport')).toEqual({ main: 'transport' });
    expect(parseCategory('uncategorized')).toBeNull();
    expect(parseCategory('transport/nope')).toBeNull();
    expect(parseCategory('constructor')).toBeNull();
    expect(parseCategory('a/b/c')).toBeNull();
    expect(parseCategory(undefined)).toBeNull();
  });

  it('has a few hundred brands, none listed twice', () => {
    const names = BRAND_PHRASES.map((brand) => brand.words.join(' '));
    expect(names.length).toBeGreaterThanOrEqual(250);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('brands (D22)', () => {
  it.each([
    ['MIGROS KADIKOY', 'groceries/supermarket'],
    ['MİGROS KADIKÖY', 'groceries/supermarket'],
    ['migros', 'groceries/supermarket'],
    ['A101 YENI MAGAZACILIK A.S.', 'groceries/supermarket'],
    ['ŞOK MARKET 1234', 'groceries/supermarket'],
    ['BİM A.Ş. ANKARA', 'groceries/supermarket'],
    ['YEMEKSEPETI.COM', 'eating-out/delivery'],
    ['IYZICO *YEMEKSEPETI ISTANBUL', 'eating-out/delivery'],
    ['KAHVE DÜNYASI BEŞİKTAŞ', 'eating-out/cafe'],
    ['OPET ISTANBUL 4829', 'transport/fuel'],
    ['PETROL OFISI A.S.', 'transport/fuel'],
    ['TURKCELL FATURA', 'bills/phone'],
    ['TÜRK TELEKOM', 'bills/phone'],
    ['NETFLIX.COM', 'subscriptions/video'],
    ['GOOGLE *YOUTUBE PREMIUM', 'subscriptions/video'],
    ['AMAZON PRIME TR', 'subscriptions/video'],
    ['AMAZON.COM.TR', 'shopping/online'],
    ['H&M ISTINYE', 'shopping/clothing'],
    ['D&R ISTANBUL', 'education/books'],
    ['N11.COM', 'shopping/online'],
    ['MEDIAMARKT TAKSIT 3/6', 'shopping/electronics'],
    ['PAYTR *TRENDYOL 1234', 'shopping/online'],
    ['THY ONLINE', 'travel/flights'],
  ])('%s is %s', (description, expected) => {
    expect(path(description)).toBe(expected);
  });
});

describe('keywords (D22)', () => {
  it.each([
    ['KARDESLER RESTORAN', 'eating-out/restaurant'],
    ['Deniz Cafe', 'eating-out/cafe'],
    ['GUL ECZANESI', 'health/pharmacy'],
    ['MERKEZ OTOPARK', 'transport/parking'],
    ['YILMAZ AKARYAKIT', 'transport/fuel'],
    ['AYSE MARKET', 'groceries/supermarket'],
    ['SAHIL OTEL', 'travel/hotels'],
  ])('%s is %s', (description, expected) => {
    expect(path(description)).toBe(expected);
  });

  it('does not take "market" for a grocer when another trade is named', () => {
    expect(path('YILDIZ YAPI MARKET')).toBe('other');
    expect(path('OTO MARKET KARTAL')).toBe('other');
    expect(path('MAVI PET MARKET')).toBe('other');
  });
});

describe('precision: anything unclear is Other (D22)', () => {
  it.each([
    'ABC GIDA SAN. TİC. LTD.',
    'XYZ TEKSTIL PAZARLAMA A.S.',
    'POS 000123 KARTAL',
    'IYZICO/4AOTOMAT.COM ISTANBUL 3411',
    'IYZICO 1234',
    'MEHMET YILMAZ',
    'BIMSER LTD',
    'MIGROSLUK HEDIYE',
    'SHELLAC KOZMETIK',
    'MARKETING AJANS',
    'KAHVE EVI',
    'ELEKTRIK MALZEMELERI',
    '4543 **** 1234',
    '',
  ])('%s', (description) => {
    expect(path(description)).toBe('other');
  });

  it('counts a name that is also a common word only as the first word', () => {
    expect(path('FILE KADIKOY')).toBe('groceries/supermarket');
    expect(path('AHMET FILE DEPO')).toBe('other');
    expect(path('ACME SOK')).toBe('other');
  });
});

describe('order of evidence (D22)', () => {
  const rules = new Map([['migros', 'shopping/home']]);
  const subscriptionKeys = new Set(['acme', 'iyzico', 'kahve']);

  it('puts the pick above everything', () => {
    expect(categorize({ description: 'MIGROS', category: 'travel', fee: true }, { rules })).toEqual(
      { main: 'travel', source: 'pick' },
    );
  });

  it('treats uncategorized and unknown stored values as no pick', () => {
    expect(categorize({ description: 'MIGROS', category: 'uncategorized' })?.source).toBe('brand');
    expect(categorize({ description: 'MIGROS', category: 'gone/old' })?.source).toBe('brand');
  });

  it('puts the rule above flags and brands', () => {
    expect(categorize({ description: 'MIGROS KADIKOY', bill: true }, { rules })).toEqual({
      main: 'shopping',
      sub: 'home',
      source: 'rule',
    });
  });

  it('reads the flags next', () => {
    expect(categorize({ description: 'KART ÜCRETİ', fee: true })).toEqual({
      main: 'fees',
      source: 'flag',
    });
    expect(categorize({ description: 'ENERJISA', bill: true })).toEqual({
      main: 'bills',
      sub: 'electricity',
      source: 'flag',
    });
    expect(categorize({ description: 'SU ODEMESI', bill: true })).toEqual({
      main: 'bills',
      sub: undefined,
      source: 'flag',
    });
    expect(categorize({ description: 'ATM PARA ÇEKME', transfer: true })).toEqual({
      main: 'cash',
      sub: 'atm',
      source: 'flag',
    });
    expect(categorize({ description: 'GİDEN EFT MEHMET', transfer: true })).toEqual({
      main: 'other',
      source: 'flag',
    });
  });

  it('puts a Sub-Radar series above brands and keywords', () => {
    expect(categorize({ description: 'ACME MARKET' }, { subscriptionKeys })).toEqual({
      main: 'subscriptions',
      sub: undefined,
      source: 'subscription',
    });
  });

  it('ignores a series keyed on a bare processor', () => {
    expect(categorize({ description: 'IYZICO *4A' }, { subscriptionKeys })?.main).toBe('other');
  });

  it('puts brands above keywords', () => {
    expect(categorize({ description: 'SHELL MARKET' })).toEqual({
      main: 'transport',
      sub: 'fuel',
      source: 'brand',
    });
  });

  it('has no spending category for income', () => {
    expect(categorize({ description: 'MAAS MIGROS', income: true })).toBeNull();
    expect(categorize({ description: 'MIGROS', income: true, category: 'travel' })).toBeNull();
  });

  it('gives a refund its merchant category', () => {
    expect(categorize({ description: 'MIGROS İADE' })?.main).toBe('groceries');
  });
});
