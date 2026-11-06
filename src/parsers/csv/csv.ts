import Papa from 'papaparse';
import { normalizeDescription } from '../../core/finance';
import type { CurrencyCode, ImportOptions, IsoDate } from '../../types/domain';
import { detectDateOrder, parseStatementDate, type DateOrder } from '../common/dates';
import {
  detectDecimalSeparator,
  parseStatementAmount,
  type DecimalSeparator,
} from '../common/numbers';
import { foldText } from '../common/text';

/** Splits CSV text into rows of cells. The delimiter (`,`, `;`, tab) is detected. */
export function parseCsv(text: string): string[][] {
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
    skipEmptyLines: 'greedy',
    delimitersToGuess: [';', ',', '\t', '|'],
  });
  return result.data.map((row) => row.map((cell) => cell.trim()));
}

/** Which column holds what. Amounts come from one signed column or a charge/credit pair. */
export interface CsvMapping {
  date: number;
  description: number;
  amount?: number;
  /** "Borç" column: charges. */
  debit?: number;
  /** "Alacak" column: refunds and payments. */
  credit?: number;
  installment?: number;
  /** "Referans": the bank's own id for the row, used as its fingerprint (D17). */
  reference?: number;
  /** "İşlem Türü": the bank's label for the row, classified before the description (D17). */
  operationType?: number;
  /** "İşlem": a shorter label some banks add. */
  operation?: number;
}

/**
 * How the file is formatted: the header row (rows above it hold account details), the
 * decimal separator, the date order, and whether charges are positive in the amount
 * column (most banks) or negative.
 */
export type CsvOptions = ImportOptions;

export const MAPPING_FIELDS = [
  'date',
  'description',
  'amount',
  'debit',
  'credit',
  'installment',
  'reference',
  'operationType',
  'operation',
] as const;
export type MappingField = (typeof MAPPING_FIELDS)[number];

/** A row read from the file before classification. */
export interface ParsedRow {
  /** 1-based row in the file, counting non-empty rows only, for the review screen. */
  line: number;
  date: IsoDate | null;
  description: string;
  /** Signed minor units: positive is a charge. Null when unreadable. */
  amount: number | null;
  installmentColumn?: string;
  reference?: string;
  /** The bank's labels ("İşlem Türü", then "İşlem"), classified before the description. */
  labels?: string[];
  /** The date or amount only parsed with a different format than the file's. */
  guessed: boolean;
}

const HEADER_SCAN_ROWS = 30;

/**
 * The header row, within the first 30 rows: the first one naming at least two known
 * columns ("Tarih", "Açıklama", "İşlem Tutarı"…), else the first with at least two text
 * cells that is followed by a row containing a date. Banks put account details above it.
 */
export function detectHeaderRow(rows: readonly string[][]): number {
  const limit = Math.min(rows.length - 1, HEADER_SCAN_ROWS);
  // Known column names decide first, so info rows above the header are skipped (D17).
  for (let i = 0; i < limit; i++) if (looksLikeHeader(rows[i] as string[])) return i;
  for (let i = 0; i < limit; i++) {
    const row = rows[i] as string[];
    const textCells = row.filter((cell) => /\p{L}/u.test(cell) && !parseStatementDate(cell));
    const next = rows[i + 1] as string[];
    if (textCells.length >= 2 && next.some((cell) => parseStatementDate(cell))) return i;
  }
  return 0;
}

/** Profile key: the normalized header cells (D3: a profile is matched by its headers). */
export function headerSignature(header: readonly string[]): string {
  const cells = header.map((cell) => normalizeDescription(cell));
  while (cells.length > 0 && cells.at(-1) === '') cells.pop();
  return cells.join('|');
}

// Header names per field, most specific first, matched on folded text. A field takes the
// first header that matches its earliest pattern, so "Açıklama" wins over "İşlem".
const HEADER_HINTS: Record<MappingField, readonly RegExp[]> = {
  date: [
    /^tarih ?\/ ?saat$/,
    /^islem tarihi/,
    /^tarih\b/,
    /\b(?:transaction |posting )?date\b/,
    /tarih/,
  ],
  description: [/aciklama/, /\b(?:description|details|merchant|payee|isyeri|detay)\b/, /^islem$/],
  amount: [/islem tutari/, /\btutari?\b/, /\b(?:amount|miktar)\b/],
  debit: [/\b(?:borc|debit)\b/, /^harcama$/],
  credit: [/\b(?:alacak|credit)\b/],
  // "Taksit Tutarı" is an amount, not the "3/6" column.
  installment: [/^(?!.*\b(?:tutar|tutari|amount)\b).*\b(?:taksit|installment)\w*\b/],
  reference: [/\b(?:referans|reference|dekont|ref)\b/],
  operationType: [/islem (?:turu|tipi)/, /\btransaction type\b/],
  operation: [/^islem$/, /^(?:type|operation)$/],
};

/** Headers that never hold a mapped field: balances and value dates (D17). */
const IGNORED_HEADERS = /\b(?:bakiye|bakiyesi|balance|valor|kanal|sube)\b/;

/** Header names that mark the real header row below a bank's info rows. */
const KNOWN_HEADERS =
  /^(?:tarih|tarih ?\/ ?saat|islem tarihi|valor|aciklama|tutar|islem tutari|tutar tl|bakiye|ek hesap bakiyesi|referans|kanal ?\/ ?sube|islem|islem turu|taksit|borc|alacak|date|description|amount|debit|credit|balance|reference)\b/;

/** The header row names at least two of the columns banks use. */
function looksLikeHeader(row: readonly string[]): boolean {
  return row.filter((cell) => KNOWN_HEADERS.test(foldText(cell))).length >= 2;
}

/**
 * A bank account statement (hesap hareketleri, D17) rather than a card statement: its
 * header has at least two of Bakiye, Ek Hesap Bakiyesi, Kanal/Şube and Valör.
 */
export function isAccountStatement(header: readonly string[]): boolean {
  const folded = header.map((cell) => foldText(cell));
  const signals = [/^bakiye\b|\bbakiye$/, /ek hesap/, /kanal|sube/, /valor/];
  return signals.filter((signal) => folded.some((cell) => signal.test(cell))).length >= 2;
}

/** A first mapping guess from header names, then from the column contents. */
export function guessMapping(header: readonly string[], sample: readonly string[][]): CsvMapping {
  const folded = header.map((cell) => foldText(cell));
  const used = new Set(folded.flatMap((cell, i) => (IGNORED_HEADERS.test(cell) ? [i] : [])));
  const find = (field: MappingField) => {
    for (const pattern of HEADER_HINTS[field]) {
      const index = folded.findIndex((cell, i) => !used.has(i) && pattern.test(cell));
      if (index >= 0) {
        used.add(index);
        return index;
      }
    }
    return undefined;
  };
  // Installment, date and the label columns first: "Taksit Tutarı", "İşlem Tarihi" and
  // "İşlem Türü" also look like an amount and a description.
  const installment = find('installment');
  const date = find('date') ?? columnWhere(sample, used, (cell) => !!parseStatementDate(cell));
  if (date !== undefined) used.add(date);
  const reference = find('reference');
  const operationType = find('operationType');
  const description = find('description');
  const operation = find('operation');
  // A charge/credit pair only counts when both columns exist.
  const debit = find('debit');
  const credit = find('credit');
  const pair = debit !== undefined && credit !== undefined;
  if (!pair) [debit, credit].forEach((c) => c !== undefined && used.delete(c));
  const amount = pair
    ? undefined
    : (find('amount') ??
      columnWhere(sample, used, (cell) => parseStatementAmount(cell, 'TRY') !== null));
  if (amount !== undefined) used.add(amount);

  return {
    date: date ?? 0,
    description: description ?? longestTextColumn(sample, used) ?? 1,
    ...(pair ? { debit, credit } : { amount: amount ?? 2 }),
    ...(installment !== undefined ? { installment } : {}),
    ...(reference !== undefined ? { reference } : {}),
    ...(operationType !== undefined ? { operationType } : {}),
    ...(operation !== undefined ? { operation } : {}),
  };
}

/** Detects the decimal separator and date order from the mapped columns. */
export function guessOptions(
  rows: readonly string[][],
  headerRow: number,
  mapping: CsvMapping,
): CsvOptions {
  const body = rows.slice(headerRow + 1);
  const amountColumns = [mapping.amount, mapping.debit, mapping.credit].filter(
    (c): c is number => c !== undefined,
  );
  return {
    headerRow,
    decimal: detectDecimalSeparator(body.flatMap((row) => amountColumns.map((c) => row[c] ?? ''))),
    dateOrder: detectDateOrder(body.map((row) => row[mapping.date] ?? '')),
    chargeSign: detectChargeSign(rows, headerRow, mapping),
  };
}

/**
 * Whether charges are written as negative numbers: always on account statements (D17),
 * and on a card statement whose single amount column is mostly negative (some banks
 * export charges as "-45,00"). A charge/credit pair has no sign to guess.
 */
function detectChargeSign(
  rows: readonly string[][],
  headerRow: number,
  mapping: CsvMapping,
): CsvOptions['chargeSign'] {
  if (isAccountStatement(rows[headerRow] ?? [])) return 'negative';
  if (mapping.amount === undefined) return 'positive';
  let negative = 0;
  let positive = 0;
  for (const row of rows.slice(headerRow + 1)) {
    const value = parseStatementAmount(row[mapping.amount] ?? '', 'TRY');
    if (value === null || value === 0) continue;
    if (value < 0) negative++;
    else positive++;
  }
  return negative > positive ? 'negative' : 'positive';
}

export interface AutoMapping {
  mapping: CsvMapping;
  options: CsvOptions;
  /**
   * The file can be imported without asking (D16, D20): the header row names known
   * columns, the date, description and amount columns were found by their names, and
   * at least half of the rows read a date and an amount.
   */
  confident: boolean;
}

/** Finds the header row, the columns and the formats of a file on its own. */
export function autoMap(rows: readonly string[][], currency: CurrencyCode): AutoMapping {
  const headerRow = detectHeaderRow(rows);
  const header = rows[headerRow] ?? [];
  const mapping = guessMapping(header, rows.slice(headerRow + 1));
  const options = guessOptions(rows, headerRow, mapping);
  return { mapping, options, confident: isConfident(rows, header, mapping, options, currency) };
}

function isConfident(
  rows: readonly string[][],
  header: readonly string[],
  mapping: CsvMapping,
  options: CsvOptions,
  currency: CurrencyCode,
): boolean {
  if (!looksLikeHeader(header) || !isCompleteMapping(mapping)) return false;
  const named = (field: MappingField) => {
    const column = mapping[field];
    if (column === undefined) return false;
    const cell = foldText(header[column] ?? '');
    return HEADER_HINTS[field].some((pattern) => pattern.test(cell));
  };
  const amounts: MappingField[] = mapping.amount !== undefined ? ['amount'] : ['debit', 'credit'];
  if (!(['date', 'description', ...amounts] as const).every(named)) return false;
  const parsed = extractRows(rows, mapping, options, currency);
  if (parsed.length === 0) return false;
  const dates = parsed.filter((row) => row.date !== null).length;
  const values = parsed.filter((row) => row.amount !== null).length;
  return dates * 2 >= parsed.length && values * 2 >= parsed.length;
}

/**
 * A note line, not a movement: one filled cell that is neither a date nor an amount, such
 * as a footnote ("(*) Çekilen tutar '-' ile gösterilmiştir.") or the bank's disclaimer
 * below the movements. A real movement always fills more than one cell.
 */
export function isNoteRow(row: readonly string[]): boolean {
  const filled = row.filter((cell) => cell.trim() !== '');
  if (filled.length !== 1) return false;
  const cell = filled[0] as string;
  return !parseStatementDate(cell) && parseStatementAmount(cell, 'TRY') === null;
}

/** Reads the rows below the header with the mapping. Empty rows and note lines are left out. */
export function extractRows(
  rows: readonly string[][],
  mapping: CsvMapping,
  options: CsvOptions,
  currency: CurrencyCode,
): ParsedRow[] {
  const result: ParsedRow[] = [];
  rows.forEach((row, i) => {
    if (i <= options.headerRow) return;
    const cell = (column: number | undefined) => (column === undefined ? '' : (row[column] ?? ''));
    const mapped = [
      mapping.date,
      mapping.description,
      mapping.amount,
      mapping.debit,
      mapping.credit,
    ];
    if (mapped.every((column) => cell(column) === '') || isNoteRow(row)) return;

    const date = readDate(cell(mapping.date), options.dateOrder);
    const amount = readAmount(row, mapping, options, currency);
    const installmentColumn = cell(mapping.installment);
    const reference = cell(mapping.reference);
    const labels = [cell(mapping.operationType), cell(mapping.operation)].filter(Boolean);
    const description = cell(mapping.description) || labels.at(-1) || '';
    result.push({
      line: i + 1,
      date: date.value,
      description: description.replace(/\s+/g, ' '),
      amount: amount.value,
      ...(installmentColumn ? { installmentColumn } : {}),
      ...(reference ? { reference } : {}),
      ...(labels.length > 0 ? { labels } : {}),
      guessed: date.guessed || amount.guessed,
    });
  });
  return result;
}

interface Read<T> {
  value: T | null;
  guessed: boolean;
}

function readDate(text: string, order: DateOrder): Read<IsoDate> {
  const value = parseStatementDate(text, order);
  if (value || !text) return { value, guessed: false };
  for (const other of ['DMY', 'MDY', 'YMD'] as const) {
    const guess = parseStatementDate(text, other);
    if (guess) return { value: guess, guessed: true };
  }
  return { value: null, guessed: false };
}

function readNumber(text: string, decimal: DecimalSeparator, currency: CurrencyCode): Read<number> {
  if (!text) return { value: null, guessed: false };
  const value = parseStatementAmount(text, currency, decimal);
  if (value !== null) return { value, guessed: false };
  const guess = parseStatementAmount(text, currency);
  return { value: guess, guessed: guess !== null };
}

function readAmount(
  row: readonly string[],
  mapping: CsvMapping,
  options: CsvOptions,
  currency: CurrencyCode,
): Read<number> {
  const cell = (column: number | undefined) => (column === undefined ? '' : (row[column] ?? ''));
  if (mapping.amount !== undefined) {
    const read = readNumber(cell(mapping.amount), options.decimal, currency);
    if (read.value === null || options.chargeSign === 'positive') return read;
    return { ...read, value: read.value === 0 ? 0 : -read.value };
  }
  const debit = readNumber(cell(mapping.debit), options.decimal, currency);
  const credit = readNumber(cell(mapping.credit), options.decimal, currency);
  if (debit.value === null && credit.value === null) return { value: null, guessed: false };
  return {
    value: Math.abs(debit.value ?? 0) - Math.abs(credit.value ?? 0),
    guessed: debit.guessed || credit.guessed,
  };
}

function columnWhere(
  sample: readonly string[][],
  used: ReadonlySet<number>,
  test: (cell: string) => boolean,
): number | undefined {
  const width = Math.max(0, ...sample.map((row) => row.length));
  for (let c = 0; c < width; c++) {
    if (used.has(c)) continue;
    const cells = sample.map((row) => row[c] ?? '').filter(Boolean);
    if (cells.length > 0 && cells.every(test)) return c;
  }
  return undefined;
}

function longestTextColumn(
  sample: readonly string[][],
  used: ReadonlySet<number>,
): number | undefined {
  const width = Math.max(0, ...sample.map((row) => row.length));
  let best: number | undefined;
  let bestLength = 0;
  for (let c = 0; c < width; c++) {
    if (used.has(c)) continue;
    const length = sample.reduce((total, row) => total + (row[c]?.length ?? 0), 0);
    if (length > bestLength) {
      best = c;
      bestLength = length;
    }
  }
  return best;
}

/** A mapping as stored in an import profile: field → column index as a string. */
export function toColumnMap(mapping: CsvMapping): Record<string, string> {
  const map: Record<string, string> = {};
  for (const field of MAPPING_FIELDS) {
    const column = mapping[field];
    if (column !== undefined) map[field] = String(column);
  }
  return map;
}

/** Reads a stored column map; null when it lacks a date, description or amount column. */
export function fromColumnMap(map: Readonly<Record<string, string>>): CsvMapping | null {
  const read = (field: MappingField) => {
    const value = map[field];
    return value !== undefined && /^\d+$/.test(value) ? Number(value) : undefined;
  };
  const mapping: CsvMapping = { date: read('date') ?? -1, description: read('description') ?? -1 };
  // Every optional column comes back, so a saved account-statement mapping keeps its
  // Referans and İşlem Türü / İşlem columns (D17).
  for (const field of MAPPING_FIELDS) {
    if (field === 'date' || field === 'description') continue;
    const column = read(field);
    if (column !== undefined) mapping[field] = column;
  }
  return isCompleteMapping(mapping) ? mapping : null;
}

/**
 * The mapping names a date, a description and either an amount column or a charge and
 * credit pair, each in a different column.
 */
export function isCompleteMapping(mapping: CsvMapping): boolean {
  const amounts =
    mapping.amount !== undefined
      ? [mapping.amount]
      : mapping.debit !== undefined && mapping.credit !== undefined
        ? [mapping.debit, mapping.credit]
        : null;
  if (!amounts || mapping.date < 0 || mapping.description < 0) return false;
  const columns = [mapping.date, mapping.description, ...amounts];
  if (mapping.installment !== undefined) columns.push(mapping.installment);
  return new Set(columns).size === columns.length;
}
