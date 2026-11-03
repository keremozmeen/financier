import { draftRows } from '../../core/import';
import {
  detectHeaderRow,
  extractRows,
  guessMapping,
  guessOptions,
  isAccountStatement,
} from '../csv';
import { accountFile, ACCOUNT_HEADER, ACCOUNT_MOVEMENTS } from './fixtures';
import { readSpreadsheet, sniffSheetFormat } from './read';

const formats = ['xls', 'xlsx', 'html'] as const;

async function parse(format: (typeof formats)[number]) {
  const bytes = accountFile(format);
  const rows = await readSpreadsheet(bytes, sniffSheetFormat(bytes)!);
  const headerRow = detectHeaderRow(rows);
  const mapping = guessMapping(rows[headerRow]!, rows.slice(headerRow + 1));
  const options = guessOptions(rows, headerRow, mapping);
  return { rows, headerRow, mapping, options, parsed: extractRows(rows, mapping, options, 'TRY') };
}

describe('sniffSheetFormat', () => {
  it('tells the formats apart by their first bytes', () => {
    expect(sniffSheetFormat(accountFile('xlsx'))).toBe('xlsx');
    expect(sniffSheetFormat(accountFile('xls'))).toBe('xls');
    expect(sniffSheetFormat(accountFile('html'))).toBe('html');
    expect(sniffSheetFormat(new TextEncoder().encode('﻿  <!DOCTYPE html><table>'))).toBe('html');
    expect(sniffSheetFormat(new TextEncoder().encode('Tarih;Açıklama;Tutar'))).toBeNull();
  });
});

describe.each(formats)('reading an account statement saved as %s (D17, D18)', (format) => {
  it('skips the info rows and finds the header by its column names', async () => {
    const { rows, headerRow } = await parse(format);
    expect(rows[headerRow]).toEqual([...ACCOUNT_HEADER]);
    expect(headerRow).toBe(4);
    expect(isAccountStatement(rows[headerRow]!)).toBe(true);
  });

  it('maps Tarih/Saat (not Valör), İşlem Tutarı (not Bakiye) and Referans', async () => {
    const { mapping, options } = await parse(format);
    expect(mapping).toEqual({
      date: 0,
      amount: 3,
      operation: 6,
      operationType: 7,
      description: 8,
      reference: 9,
    });
    expect(options).toMatchObject({
      chargeSign: 'negative',
      dateOrder: format === 'html' ? 'DMY' : 'YMD',
    });
  });

  it('reads the same dates, amounts and references in every format', async () => {
    const { parsed } = await parse(format);
    expect(parsed.map((row) => [row.date, row.amount, row.reference])).toEqual(
      ACCOUNT_MOVEMENTS.map((m) => [
        `${m.at.slice(6, 10)}-${m.at.slice(3, 5)}-${m.at.slice(0, 2)}`,
        // Money out is a positive (charge) amount once the sign convention is applied.
        -m.amount,
        m.reference,
      ]),
    );
    expect(parsed[1]).toMatchObject({
      description: 'MIGROS KADIKOY',
      labels: ['POS Harcama', 'Harcama'],
    });
  });

  it('classifies every D17 row type', async () => {
    const { parsed } = await parse(format);
    expect(draftRows(parsed, 'debit', 'account').map((row) => [row.description, row.type])).toEqual(
      [
        ['ACME A.Ş. EKİM MAAŞ', 'income'],
        ['MIGROS KADIKOY', 'charge'],
        ['NETFLIX.COM', 'charge'],
        ['AYŞE YILMAZ', 'income'],
        ['KREDİ KARTI ÖDEMESİ 5555********1234', 'payment'],
        ['ATM KADIKOY', 'transfer'],
        ['MEHMET DEMİR KİRA', 'transfer'],
        ['ENERJİSA ELEKTRİK FATURASI', 'bill'],
        ['ZARA IADE', 'refund'],
        ['HESAP İŞLETİM ÜCRETİ', 'fee'],
      ],
    );
  });
});

describe('readSpreadsheet', () => {
  it('keeps HTML cells as written, so "1.250" stays a Turkish thousand', async () => {
    const html = new TextEncoder().encode(
      '<html><table><tr><td>Tarih</td><td>Tutar</td></tr><tr><td>03.11.2026 14:22</td><td>1.250</td></tr></table></html>',
    );
    expect(await readSpreadsheet(html, 'html')).toEqual([
      ['Tarih', 'Tutar'],
      ['03.11.2026 14:22', '1.250'],
    ]);
  });

  it('reads HTML saved in the Turkish Windows code page', async () => {
    // "<table><tr><td>Açıklama</td></tr></table>" with ç=0xE7, ı=0xFD in Windows-1254
    const text = '<table><tr><td>Açýklama</td></tr></table>';
    const bytes = Uint8Array.from(text, (c) => c.charCodeAt(0));
    expect(await readSpreadsheet(bytes, 'html')).toEqual([['Açıklama']]);
  });
});
