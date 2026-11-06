import { decodeText } from './decode';
import {
  autoMap,
  detectHeaderRow,
  fromColumnMap,
  isCompleteMapping,
  toColumnMap,
  extractRows,
  guessMapping,
  guessOptions,
  headerSignature,
  isAccountStatement,
  isNoteRow,
  parseCsv,
} from './csv';
import { CREDIT_CARD_CSV, DEBIT_CARD_CSV } from './fixtures';

describe('decodeText', () => {
  it('reads UTF-8 with a BOM', () => {
    const bytes = new TextEncoder().encode('\uFEFFİşlem Tarihi;Açıklama');
    expect(decodeText(bytes).replace(/^\uFEFF/, '')).toBe('İşlem Tarihi;Açıklama');
  });

  it('falls back to Windows-1254 for Turkish exports', () => {
    // "İŞLEM;ÖDEME;ışğ" in code page 1254
    const bytes = new Uint8Array([
      0xdd, 0xde, 0x4c, 0x45, 0x4d, 0x3b, 0xd6, 0x44, 0x45, 0x4d, 0x45, 0x3b, 0xfd, 0xfe, 0xf0,
    ]);
    expect(decodeText(bytes)).toBe('İŞLEM;ÖDEME;ışğ');
  });
});

describe('parseCsv', () => {
  it('detects the semicolon delimiter and trims cells', () => {
    const rows = parseCsv(CREDIT_CARD_CSV);
    expect(rows[2]).toEqual(['İşlem Tarihi', 'Açıklama', 'Taksit', 'Tutar (TL)']);
    expect(rows[3]).toEqual(['12.09.2026', 'ÖNCEKİ DÖNEM BAKİYESİ', '', '4.250,00']);
  });

  it('handles quoted cells with the delimiter inside', () => {
    expect(parseCsv('a,b\n"MIGROS, KADIKOY","1,50"\n')).toEqual([
      ['a', 'b'],
      ['MIGROS, KADIKOY', '1,50'],
    ]);
  });
});

describe('header and mapping', () => {
  const rows = parseCsv(CREDIT_CARD_CSV);

  it('skips the account details above the header', () => {
    expect(detectHeaderRow(rows)).toBe(2);
    expect(detectHeaderRow(parseCsv(DEBIT_CARD_CSV))).toBe(0);
  });

  it('builds a stable signature from the headers', () => {
    expect(headerSignature(rows[2]!)).toBe('islem tarihi|aciklama|taksit|tutar tl');
    expect(headerSignature(['DATE ', 'Description', ''])).toBe('date|description');
  });

  it('guesses the mapping from Turkish headers', () => {
    expect(guessMapping(rows[2]!, rows.slice(3))).toEqual({
      date: 0,
      description: 1,
      installment: 2,
      amount: 3,
    });
  });

  it('guesses a debit/credit column pair', () => {
    const debit = parseCsv(DEBIT_CARD_CSV);
    expect(guessMapping(debit[0]!, debit.slice(1))).toEqual({
      date: 0,
      description: 1,
      debit: 2,
      credit: 3,
    });
  });

  it('falls back to the column contents when headers say nothing', () => {
    const sample = [
      ['MIGROS', '15.09.2026', '1.234,56'],
      ['A101 MARKET', '16.09.2026', '45,00'],
    ];
    expect(guessMapping(['A', 'B', 'C'], sample)).toEqual({ date: 1, description: 0, amount: 2 });
  });

  it('does not take an installment amount column for the marker', () => {
    const mapping = guessMapping(
      ['Tarih', 'Açıklama', 'Taksit Tutarı'],
      [['01.09.2026', 'X', '1,00']],
    );
    expect(mapping.installment).toBeUndefined();
    expect(mapping.amount).toBe(2);
  });

  it('detects number and date formats', () => {
    expect(guessOptions(rows, 2, guessMapping(rows[2]!, rows.slice(3)))).toEqual({
      headerRow: 2,
      decimal: ',',
      dateOrder: 'DMY',
      chargeSign: 'positive',
    });
    const debit = parseCsv(DEBIT_CARD_CSV);
    expect(guessOptions(debit, 0, { date: 0, description: 1, debit: 2, credit: 3 })).toMatchObject({
      decimal: '.',
      dateOrder: 'YMD',
    });
  });
});

describe('isNoteRow', () => {
  it('finds footnotes and disclaimers written in one cell', () => {
    expect(isNoteRow(["(*) Çekilen tutar '-' ile gösterilmiştir.", '', ''])).toBe(true);
    expect(isNoteRow(['', 'Bu belge bilgi amaçlıdır.'])).toBe(true);
    expect(isNoteRow(['Mersis No: 0000000000000000'])).toBe(true);
  });

  it('keeps anything that could be a movement', () => {
    expect(isNoteRow(['03.10.2026', 'MIGROS', '-1.234,56'])).toBe(false);
    expect(isNoteRow(['MIGROS', '-1.234,56'])).toBe(false);
    // A lone date or amount may be a broken row: the review shows it as needing a fix.
    expect(isNoteRow(['03.10.2026'])).toBe(false);
    expect(isNoteRow(['', '-1.234,56'])).toBe(false);
    expect(isNoteRow(['', ''])).toBe(false);
  });
});

describe('extractRows', () => {
  it('leaves note lines out but keeps broken movements for the review', () => {
    const rows = [
      ['Tarih', 'Açıklama', 'Tutar'],
      ['03.10.2026', 'MIGROS', '1.234,56'],
      ['', 'BOZUK SATIR', 'abc'],
      ['(*) Çekilen tutar eksi ile gösterilmiştir.'],
    ];
    const mapping = guessMapping(rows[0]!, rows.slice(1));
    const parsed = extractRows(rows, mapping, guessOptions(rows, 0, mapping), 'TRY');
    expect(parsed.map((row) => [row.description, row.date, row.amount])).toEqual([
      ['MIGROS', '2026-10-03', 123_456],
      ['BOZUK SATIR', null, null],
    ]);
  });

  it('reads signed amounts in minor units with Turkish formats', () => {
    const rows = parseCsv(CREDIT_CARD_CSV);
    const mapping = guessMapping(rows[2]!, rows.slice(3));
    const parsed = extractRows(rows, mapping, guessOptions(rows, 2, mapping), 'TRY');
    expect(parsed).toHaveLength(8);
    expect(parsed[1]).toEqual({
      line: 5,
      date: '2026-09-15',
      description: 'MIGROS KADIKOY',
      amount: 123_456,
      guessed: false,
    });
    expect(parsed[2]).toMatchObject({ amount: -425_000 });
    expect(parsed[3]).toMatchObject({ installmentColumn: '3/6', amount: 50_000 });
  });

  it('subtracts the credit column from the debit column', () => {
    const rows = parseCsv(DEBIT_CARD_CSV);
    const mapping = { date: 0, description: 1, debit: 2, credit: 3 };
    const parsed = extractRows(rows, mapping, guessOptions(rows, 0, mapping), 'TRY');
    expect(parsed.map((row) => row.amount)).toEqual([9500, 9500, -150_000, 425_000]);
  });

  it('flips the sign when charges are negative in the file', () => {
    const rows = [
      ['Tarih', 'Açıklama', 'Tutar'],
      ['01.09.2026', 'MIGROS', '-45,00'],
      ['02.09.2026', 'ÖDEME', '500,00'],
    ];
    const parsed = extractRows(
      rows,
      { date: 0, description: 1, amount: 2 },
      { headerRow: 0, decimal: ',', dateOrder: 'DMY', chargeSign: 'negative' },
      'TRY',
    );
    expect(parsed.map((row) => row.amount)).toEqual([4500, -50_000]);
  });

  it('flags values that needed another format and keeps unreadable ones as null', () => {
    const rows = [
      ['Tarih', 'Açıklama', 'Tutar'],
      ['13/25/2026', 'A', '45,00'],
      ['10/25/2026', 'B', '1,234.50'],
      ['xx', 'C', 'abc'],
      ['', '', ''],
    ];
    const parsed = extractRows(
      rows,
      { date: 0, description: 1, amount: 2 },
      { headerRow: 0, decimal: ',', dateOrder: 'DMY', chargeSign: 'positive' },
      'TRY',
    );
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ date: null, amount: 4500, guessed: false });
    expect(parsed[1]).toMatchObject({ date: '2026-10-25', amount: 123_450, guessed: true });
    expect(parsed[2]).toMatchObject({ date: null, amount: null });
  });
});

describe('profile column maps', () => {
  it('round-trips a mapping', () => {
    const mapping = { date: 0, description: 1, amount: 3, installment: 2 };
    expect(toColumnMap(mapping)).toEqual({
      date: '0',
      description: '1',
      amount: '3',
      installment: '2',
    });
    expect(fromColumnMap(toColumnMap(mapping))).toEqual(mapping);
    const pair = { date: 0, description: 1, debit: 2, credit: 3 };
    expect(fromColumnMap(toColumnMap(pair))).toEqual(pair);
  });

  it('keeps the reference and label columns of an account statement (D17)', () => {
    const account = {
      date: 0,
      description: 8,
      amount: 3,
      reference: 9,
      operationType: 7,
      operation: 6,
    };
    expect(fromColumnMap(toColumnMap(account))).toEqual(account);
  });

  it('rejects incomplete or overlapping mappings', () => {
    expect(fromColumnMap({ date: '0', description: '1' })).toBeNull();
    expect(fromColumnMap({ date: '0', description: '1', debit: '2' })).toBeNull();
    expect(fromColumnMap({ date: '0', description: 'x', amount: '2' })).toBeNull();
    expect(isCompleteMapping({ date: 0, description: 0, amount: 1 })).toBe(false);
    expect(isCompleteMapping({ date: 0, description: 1, amount: 2, installment: 2 })).toBe(false);
    expect(isCompleteMapping({ date: 0, description: 1, amount: 2 })).toBe(true);
  });
});

describe('account statements (D17)', () => {
  const header = [
    'Tarih/Saat',
    'Valör',
    'Kanal/Şube',
    'İşlem Tutarı',
    'Bakiye',
    'Ek Hesap Bakiyesi',
    'İşlem',
    'İşlem Türü',
    'Açıklama',
    'Referans',
  ];

  it('detects an account statement by its balance and channel columns', () => {
    expect(isAccountStatement(header)).toBe(true);
    expect(isAccountStatement(['İşlem Tarihi', 'Açıklama', 'Taksit', 'Tutar (TL)'])).toBe(false);
    // One signal alone is not enough.
    expect(isAccountStatement(['Tarih', 'Açıklama', 'Tutar', 'Bakiye'])).toBe(false);
  });

  it('finds the header below info rows by its column names', () => {
    const rows = [
      ['TÜRKİYE İŞ BANKASI'],
      ['Tarih Aralığı', '01.10.2026 - 31.10.2026'],
      header,
      ['03.11.2026 14:22'],
    ];
    expect(detectHeaderRow(rows)).toBe(2);
  });

  it('never maps Valör, Kanal/Şube or a balance column', () => {
    const mapping = guessMapping(header, []);
    expect(Object.values(mapping)).not.toEqual(expect.arrayContaining([1, 2, 4, 5]));
    expect(mapping).toMatchObject({ date: 0, amount: 3, description: 8, reference: 9 });
  });

  it('treats money out as charges', () => {
    const rows = [
      header,
      [
        '03.11.2026 14:22',
        '03.11.2026',
        'POS',
        '-1.234,56',
        '9.000,00',
        '0,00',
        'Harcama',
        'POS',
        'MIGROS',
        'R1',
      ],
    ];
    const mapping = guessMapping(header, rows.slice(1));
    const options = guessOptions(rows, 0, mapping);
    expect(options.chargeSign).toBe('negative');
    expect(extractRows(rows, mapping, options, 'TRY')[0]).toMatchObject({
      date: '2026-11-03',
      amount: 123_456,
      reference: 'R1',
      labels: ['POS', 'Harcama'],
    });
  });
});

describe('autoMap (D16, D20)', () => {
  it('reads a card statement with info rows above the header on its own', () => {
    const auto = autoMap(parseCsv(CREDIT_CARD_CSV), 'TRY');
    expect(auto.confident).toBe(true);
    expect(auto.mapping).toMatchObject({ date: 0, description: 1, installment: 2, amount: 3 });
    expect(auto.options).toMatchObject({ headerRow: 2, decimal: ',', chargeSign: 'positive' });
  });

  it('reads a debit card file with charge and credit columns on its own', () => {
    const auto = autoMap(parseCsv(DEBIT_CARD_CSV), 'TRY');
    expect(auto.confident).toBe(true);
    expect(auto.mapping).toMatchObject({ date: 0, description: 1, debit: 2, credit: 3 });
  });

  it('asks when the headers are unknown', () => {
    const rows = [
      ['Col A', 'Col B', 'Col C'],
      ['01.09.2026', 'MIGROS', '45,00'],
      ['02.09.2026', 'SHELL', '1.200,00'],
    ];
    expect(autoMap(rows, 'TRY').confident).toBe(false);
  });

  it('asks when most rows do not read with the guess', () => {
    const rows = [
      ['Tarih', 'Açıklama', 'Tutar'],
      ['01.09.2026', 'MIGROS', '45,00'],
      ['yesterday', 'SHELL', 'abc'],
      ['soon', 'ZARA', 'n/a'],
    ];
    expect(autoMap(rows, 'TRY').confident).toBe(false);
  });

  it('detects a card statement that writes charges as negative numbers', () => {
    const rows = [
      ['Tarih', 'İşlem Açıklaması', 'Tutar'],
      ['01.10.2026', 'ŞEKERCİ HACI BEKİR', '-145,00'],
      ['03.10.2026', 'GÜLLÜOĞLU', '-320,50'],
      ['05.10.2026', 'İADE ÇİÇEKSEPETİ', '89,90'],
    ];
    const auto = autoMap(rows, 'TRY');
    expect(auto.options.chargeSign).toBe('negative');
    expect(extractRows(rows, auto.mapping, auto.options, 'TRY').map((r) => r.amount)).toEqual([
      14_500, 32_050, -8_990,
    ]);
  });
});
