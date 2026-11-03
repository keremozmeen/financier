import { decodeText } from '../csv/decode';

/** Spreadsheet formats the import accepts (D18). */
export type SheetFormat = 'xlsx' | 'xls' | 'html';

/**
 * What a file holds, from its first bytes: a ZIP (xlsx), an OLE compound file (legacy
 * xls), or an HTML table saved with an .xls name, as many Turkish banks export.
 * Returns null for anything else (CSV and plain text).
 */
export function sniffSheetFormat(bytes: Uint8Array): SheetFormat | null {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return 'xlsx';
  if ([0xd0, 0xcf, 0x11, 0xe0].every((b, i) => bytes[i] === b)) return 'xls';
  // Skip a UTF-8 byte order mark (EF BB BF) before looking for HTML.
  const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  const head = new TextDecoder('latin1')
    .decode(bytes.subarray(start, start + 2048))
    .trimStart()
    .toLowerCase();
  if (head.startsWith('<') && /<(?:table|html|!doctype html)/.test(head)) return 'html';
  return null;
}

/**
 * Reads the first non-empty sheet into rows of text cells, like the CSV reader returns.
 * SheetJS is loaded only when a spreadsheet is opened, so it never weighs on the rest of
 * the app (D18). Date cells become "YYYY-MM-DD HH:MM" and numbers plain decimals ("-1234.56");
 * HTML cells are kept exactly as written, so "1.250" stays a Turkish thousand.
 */
export async function readSpreadsheet(bytes: Uint8Array, format: SheetFormat): Promise<string[][]> {
  const XLSX = await import('xlsx');
  const book =
    format === 'html'
      ? XLSX.read(decodeText(bytes), { type: 'string', raw: true, dense: true })
      : XLSX.read(bytes, { type: 'array', cellDates: true, UTC: true, dense: true });

  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false,
      UTC: true,
    });
    const text = rows
      .map((row) => row.map(cellText))
      .filter((row) => row.some((cell) => cell !== ''));
    if (text.length > 0) return text;
  }
  return [];
}

function cellText(value: unknown): string {
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
    const time = value.getUTCHours() || value.getUTCMinutes();
    return time ? `${date} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}` : date;
  }
  if (typeof value === 'number') {
    // Spreadsheet numbers are binary floats: round to the cent before turning them into
    // text, which parseStatementAmount then reads exactly (D2).
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  }
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
