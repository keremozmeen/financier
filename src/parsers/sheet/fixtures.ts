// Synthetic İş Bankası-style account statement (hesap hareketleri). No real data (CLAUDE.md).
// Used by tests only: it builds the same statement as .xls, .xlsx and HTML saved as .xls.
import * as XLSX from 'xlsx';

export const ACCOUNT_HEADER = [
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
] as const;

/** Info rows above the header, as the bank prints them. */
export const ACCOUNT_INFO = [
  ['TÜRKİYE İŞ BANKASI A.Ş.'],
  ['Hesap Hareketleri'],
  ['Hesap No', '1234 - 0000000'],
  ['Tarih Aralığı', '01.10.2026 - 31.10.2026'],
];

interface Movement {
  at: string; // "dd.mm.yyyy hh:mm"
  channel: string;
  amount: number; // kuruş, negative = money out
  balance: number;
  operation: string;
  type: string;
  description: string;
  reference: string;
}

/** One row of each D17 type. The credit card payment names the card ending 1234. */
export const ACCOUNT_MOVEMENTS: Movement[] = [
  {
    at: '01.10.2026 09:15',
    channel: 'Mobil',
    amount: 4_500_000,
    balance: 4_750_000,
    operation: 'Gelen EFT',
    type: 'Maaş Ödemesi',
    description: 'ACME A.Ş. EKİM MAAŞ',
    reference: '20261001000001',
  },
  {
    at: '03.10.2026 12:40',
    channel: 'POS',
    amount: -123_456,
    balance: 4_626_544,
    operation: 'Harcama',
    type: 'POS Harcama',
    description: 'MIGROS KADIKOY',
    reference: '20261003000002',
  },
  {
    at: '05.10.2026 20:05',
    channel: 'İnternet',
    amount: -22_999,
    balance: 4_603_545,
    operation: 'Harcama',
    type: 'İnternet Alışveriş',
    description: 'NETFLIX.COM',
    reference: '20261005000003',
  },
  {
    at: '07.10.2026 10:00',
    channel: 'Mobil',
    amount: 250_000,
    balance: 4_853_545,
    operation: 'Gelen FAST',
    type: 'Para Transferi',
    description: 'AYŞE YILMAZ',
    reference: '20261007000004',
  },
  {
    at: '10.10.2026 08:30',
    channel: 'Otomatik',
    amount: -425_000,
    balance: 4_428_545,
    operation: 'Kredi Kartı',
    type: 'Kredi Kartı Ödemesi',
    description: 'KREDİ KARTI ÖDEMESİ 5555********1234',
    reference: '20261010000005',
  },
  {
    at: '12.10.2026 18:45',
    channel: 'ATM',
    amount: -200_000,
    balance: 4_228_545,
    operation: 'Para Çekme',
    type: 'ATM Para Çekme',
    description: 'ATM KADIKOY',
    reference: '20261012000006',
  },
  {
    at: '15.10.2026 11:20',
    channel: 'Mobil',
    amount: -300_000,
    balance: 3_928_545,
    operation: 'Giden EFT',
    type: 'EFT',
    description: 'MEHMET DEMİR KİRA',
    reference: '20261015000007',
  },
  {
    at: '18.10.2026 07:00',
    channel: 'Otomatik',
    amount: -48_990,
    balance: 3_879_555,
    operation: 'Fatura',
    type: 'Otomatik Ödeme Talimatı',
    description: 'ENERJİSA ELEKTRİK FATURASI',
    reference: '20261018000008',
  },
  {
    at: '20.10.2026 14:22',
    channel: 'POS',
    amount: 29_990,
    balance: 3_909_545,
    operation: 'İade',
    type: 'POS İade',
    description: 'ZARA IADE',
    reference: '20261020000009',
  },
  {
    at: '25.10.2026 23:59',
    channel: 'Şube',
    amount: -1_250,
    balance: 3_908_295,
    operation: 'Masraf',
    type: 'Hesap İşletim Ücreti',
    description: 'HESAP İŞLETİM ÜCRETİ',
    reference: '20261025000010',
  },
];

/** "1.234,56" from kuruş, as the bank prints amounts in text exports. */
function turkish(kurus: number): string {
  const sign = kurus < 0 ? '-' : '';
  const abs = Math.abs(kurus);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${whole},${String(abs % 100).padStart(2, '0')}`;
}

function utcDate(at: string): Date {
  const [d, m, y, hh, mm] = at.split(/[. :]/).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  return new Date(Date.UTC(y, m - 1, d, hh, mm));
}

/** The statement as text cells, as an HTML export shows it. */
export function accountTextRows(movements = ACCOUNT_MOVEMENTS): string[][] {
  return [
    ...ACCOUNT_INFO,
    [...ACCOUNT_HEADER],
    ...movements.map((row) => [
      row.at,
      row.at.slice(0, 10),
      row.channel,
      turkish(row.amount),
      turkish(row.balance),
      '0,00',
      row.operation,
      row.type,
      row.description,
      row.reference,
    ]),
  ];
}

/** The statement as a real Excel workbook would hold it: date cells and number cells. */
function accountTypedRows(movements = ACCOUNT_MOVEMENTS): unknown[][] {
  return [
    ...ACCOUNT_INFO,
    [...ACCOUNT_HEADER],
    ...movements.map((row) => [
      utcDate(row.at),
      utcDate(row.at.slice(0, 10) + ' 00:00'),
      row.channel,
      row.amount / 100,
      row.balance / 100,
      0,
      row.operation,
      row.type,
      row.description,
      row.reference,
    ]),
  ];
}

/** The statement as file bytes in each format the import accepts (D18). */
export function accountFile(
  format: 'xls' | 'xlsx' | 'html',
  movements = ACCOUNT_MOVEMENTS,
): Uint8Array<ArrayBuffer> {
  if (format === 'html') {
    const cells = accountTextRows(movements)
      .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
      .join('\n');
    return new TextEncoder().encode(
      `<html><head><meta charset="utf-8"></head><body><table>\n${cells}\n</table></body></html>`,
    );
  }
  const sheet = XLSX.utils.aoa_to_sheet(accountTypedRows(movements), {
    cellDates: true,
    UTC: true,
  });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Hesap Hareketleri');
  return new Uint8Array(XLSX.write(book, { bookType: format, type: 'array' }) as ArrayBuffer);
}
