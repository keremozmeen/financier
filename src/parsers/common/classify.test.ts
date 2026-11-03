import {
  classifyAccountRow,
  classifyRow,
  lowerConfidence,
  rowTypesFor,
  type ClassifyInput,
} from './classify';

const credit = (description: string, amount: number, extra: Partial<ClassifyInput> = {}) =>
  classifyRow({ description, amount, cardType: 'credit', ...extra });
const debit = (description: string, amount: number, extra: Partial<ClassifyInput> = {}) =>
  classifyRow({ description, amount, cardType: 'debit', ...extra });

describe('classifyRow (D16)', () => {
  describe('charges and refunds', () => {
    it('imports a plain positive row as a charge', () => {
      expect(credit('MIGROS KADIKOY', 45_000)).toEqual({ type: 'charge', confidence: 'high' });
    });

    it.each(['ZARA İADE', 'IADE - TRENDYOL', 'AMAZON REFUND', 'SİPARİŞ İPTALİ'])(
      'reads %s on a credit row as a refund',
      (description) => {
        expect(credit(description, -12_000)).toEqual({ type: 'refund', confidence: 'high' });
      },
    );

    it('treats an unlabelled credit row as a refund with medium confidence', () => {
      expect(credit('TRENDYOL', -12_000)).toEqual({ type: 'refund', confidence: 'medium' });
    });
  });

  describe('installment slices', () => {
    it.each([
      ['TEKNOSA TAKSİT 3/6', 3, 6],
      ['MEDIAMARKT 2/12 TAKSİT', 2, 12],
      ['APPLE INSTALLMENT 4 OF 9', 4, 9],
    ])('reads %s', (description, index, count) => {
      expect(credit(description, 50_000)).toEqual({
        type: 'installment',
        confidence: 'high',
        installment: { index, count, keyword: true },
      });
    });

    it('gives a bare marker medium confidence', () => {
      expect(credit('TEKNOSA 3/6', 50_000)).toMatchObject({
        type: 'installment',
        confidence: 'medium',
      });
    });

    it('reads the mapped installment column', () => {
      expect(credit('TEKNOSA', 50_000, { installmentColumn: '3/6' })).toMatchObject({
        type: 'installment',
        confidence: 'high',
        installment: { index: 3, count: 6 },
      });
      expect(credit('TEKNOSA', 50_000, { installmentColumn: '' })).toMatchObject({
        type: 'charge',
      });
    });

    it('keeps interest-free installments ("faizsiz") out of fees', () => {
      expect(credit('FAİZSİZ TAKSİT 2/3 HEPSIBURADA', 30_000)).toMatchObject({
        type: 'installment',
      });
    });

    it('imports a slice on a debit card as a plain charge (D13)', () => {
      expect(debit('TEKNOSA TAKSİT 3/6', 50_000)).toMatchObject({
        type: 'charge',
        confidence: 'high',
      });
      expect(debit('TEKNOSA', 50_000, { installmentColumn: '3/6' })).toMatchObject({
        type: 'charge',
      });
    });
  });

  describe('bill payments', () => {
    it.each([
      'ÖDEME',
      'HESAPTAN ÖDEME',
      'OTOMATİK ÖDEME',
      'OTOMATIK ODEME TALIMATI',
      'KART ÖDEMESİ - TEŞEKKÜRLER',
      'ÖDEMENİZ İÇİN TEŞEKKÜRLER',
      'INTERNET BANKACILIĞI ÖDEME',
      'PAYMENT - THANK YOU',
      'AUTOPAY',
    ])('reads %s on a credit row as a payment', (description) => {
      expect(credit(description, -500_000)).toEqual({ type: 'payment', confidence: 'high' });
    });

    it('never reads a payment as a refund', () => {
      expect(credit('ÖDEME', -500_000).type).not.toBe('refund');
    });

    it('keeps a payment keyword on a charge row as a merchant charge', () => {
      expect(credit('IYZICO ÖDEME HIZMETLERI', 45_000)).toEqual({
        type: 'charge',
        confidence: 'medium',
      });
    });

    it('classifies payments on debit cards too, so the review can explain the skip', () => {
      expect(debit('KREDİ KARTI ÖDEMESİ', -500_000).type).toBe('payment');
    });

    it.each([
      'KREDİ KARTI ÖDEMESİ',
      'KREDI KARTI BORCU ODEME 1234',
      'KK ÖDEME',
      'CREDIT CARD PAYMENT',
    ])('reads the outflow %s on a debit card as a card payment', (description) => {
      expect(debit(description, 425_000)).toEqual({ type: 'payment', confidence: 'high' });
    });

    it('keeps merchant names with "ödeme" as charges on a debit card', () => {
      expect(debit('IYZICO ÖDEME HIZMETLERI', 45_000).type).toBe('charge');
    });
  });

  describe('balance and summary lines', () => {
    it.each([
      ['ÖNCEKİ DÖNEM BAKİYESİ', 1_250_000],
      ['ÖNCEKİ EKSTRE BORCU', 1_250_000],
      ['DÖNEM BORCU', 1_250_000],
      ['DEVREDEN BAKİYE', -50_000],
      ['ASGARİ ÖDEME TUTARI', 250_000],
      ['TOPLAM BORÇ', 1_250_000],
      ['SON ÖDEME TARİHİ', 0],
      ['PREVIOUS BALANCE', 1_250_000],
      ['MINIMUM PAYMENT DUE', 250_000],
    ])('skips %s', (description, amount) => {
      expect(credit(description, amount)).toEqual({ type: 'summary', confidence: 'high' });
    });
  });

  describe('interest and fees', () => {
    it.each([
      'AKDİ FAİZ',
      'GECİKME FAİZİ',
      'BSMV',
      'KKDF',
      'KART ÜCRETİ',
      'YILLIK ÜYELİK ÜCRETİ',
      'NAKİT AVANS FAİZİ',
      'GECİKME CEZASI',
      'LATE FEE',
      'INTEREST CHARGE',
      'ANNUAL FEE',
    ])('marks %s as a fee', (description) => {
      expect(credit(description, 15_000)).toEqual({ type: 'fee', confidence: 'high' });
    });

    it('marks fees on debit cards too', () => {
      expect(debit('HESAP İŞLEM ÜCRETİ', 1_500).type).toBe('fee');
    });

    it('reads a reversed fee as a refund', () => {
      expect(credit('FAİZ İADESİ', -15_000)).toEqual({ type: 'refund', confidence: 'high' });
    });
  });
});

describe('rowTypesFor', () => {
  it('offers installments only on credit cards', () => {
    expect(rowTypesFor('credit')).toContain('installment');
    expect(rowTypesFor('debit')).not.toContain('installment');
  });
});

describe('lowerConfidence', () => {
  it('returns the lower of two flags', () => {
    expect(lowerConfidence('high', 'medium')).toBe('medium');
    expect(lowerConfidence('low', 'high')).toBe('low');
    expect(lowerConfidence('high', 'high')).toBe('high');
  });
});

describe('classifyAccountRow (D17)', () => {
  const out = (description: string, amount: number, labels?: string[]) =>
    classifyAccountRow({ description, amount, ...(labels ? { labels } : {}) }).type;

  it.each([
    ['MIGROS KADIKOY', ['POS Harcama'], 'charge'],
    ['TRENDYOL', ['İnternet Alışveriş'], 'charge'],
    ['A101', ['Temassız İşlem'], 'charge'],
    ['KREDİ KARTI ÖDEMESİ 1234', ['Kredi Kartı Ödemesi'], 'payment'],
    ['İGDAŞ', ['Otomatik Ödeme Talimatı'], 'bill'],
    ['TURKCELL FATURA', [], 'bill'],
    ['ENERJİSA ELEKTRİK', [], 'bill'],
    ['ATM KADIKOY', ['ATM Para Çekme'], 'transfer'],
    ['MEHMET DEMİR', ['Giden EFT'], 'transfer'],
    ['HAVALE', [], 'transfer'],
    ['EFT ÜCRETİ', [], 'fee'],
    ['HESAP İŞLETİM ÜCRETİ', ['Masraf'], 'fee'],
    ['DEVREDEN BAKİYE', [], 'summary'],
  ] as const)('reads the outflow %s as %s', (description, labels, type) => {
    expect(out(description, 10_000, [...labels])).toBe(type);
  });

  it.each([
    ['ACME MAAŞ', ['Maaş Ödemesi'], 'income'],
    ['AYŞE YILMAZ', ['Gelen FAST'], 'income'],
    ['AYŞE YILMAZ', ['Gelen EFT'], 'income'],
    ['ZARA IADE', ['POS İade'], 'refund'],
    ['ALIŞVERİŞ İPTAL', [], 'refund'],
  ] as const)('reads the inflow %s as %s', (description, labels, type) => {
    expect(out(description, -10_000, [...labels])).toBe(type);
  });

  it('never reads incoming money as a refund unless it says so', () => {
    expect(classifyAccountRow({ description: 'AHMET', amount: -10_000 })).toEqual({
      type: 'income',
      confidence: 'medium',
    });
  });

  it('decides by İşlem Türü before the description', () => {
    // The label says purchase, so a shop called "Fatura Kırtasiye" stays a purchase.
    expect(out('FATURA KIRTASIYE', 10_000, ['POS Harcama'])).toBe('charge');
    expect(out('FATURA KIRTASIYE', 10_000)).toBe('bill');
  });

  it('offers the account types on the review screen', () => {
    expect(rowTypesFor('debit', 'account')).toEqual(
      expect.arrayContaining(['income', 'transfer', 'bill', 'payment']),
    );
    expect(rowTypesFor('debit', 'account')).not.toContain('installment');
  });
});
