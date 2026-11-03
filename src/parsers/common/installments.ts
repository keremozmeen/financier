import { MAX_INSTALLMENTS } from '../../core/finance';
import { foldText } from './text';

/** Slice `index` (1-based) of an `count`-installment plan, as printed on a statement. */
export interface InstallmentMarker {
  index: number;
  count: number;
  /** The marker came with "taksit" / "installment", not just a bare "3/6". */
  keyword: boolean;
}

/** A bare "a/b" without a keyword counts as a marker only up to this many installments. */
const MAX_BARE_COUNT = 12;

interface Pattern {
  regex: RegExp;
  /** Capture groups holding the index and the count. */
  index: number;
  count: number;
  keyword: boolean;
}

// Matched on folded text (lower-case, accents removed, punctuation kept).
const PATTERNS: Pattern[] = [
  // "taksit 3/6", "taksit: 03/06", "taksit 3 / 6"
  { regex: /taksit\w*\s*:?\s*(\d{1,2})\s*[/\\]\s*(\d{1,2})/, index: 1, count: 2, keyword: true },
  // "3/6 taksit", "3/6.taksit"
  { regex: /(\d{1,2})\s*[/\\]\s*(\d{1,2})\s*\.?\s*taksit/, index: 1, count: 2, keyword: true },
  // "3. taksit / 6", "3.taksit/6"
  { regex: /(\d{1,2})\s*\.\s*taksit\w*\s*[/\\]\s*(\d{1,2})/, index: 1, count: 2, keyword: true },
  // "6 taksitin 3.", "6 taksitten 3"
  { regex: /(\d{1,2})\s*taksit(?:in|ten)\s*(\d{1,2})/, index: 2, count: 1, keyword: true },
  // "installment 3 of 6", "inst. 3/6", "instalment 3/6"
  {
    regex: /\b(?:installment|instalment|inst)\.?\s*(\d{1,2})\s*(?:\/|of)\s*(\d{1,2})/,
    index: 1,
    count: 2,
    keyword: true,
  },
  // A bare "3/6" or "(3/6)" standing on its own, not part of a date like "12/05/2026".
  // Capped at 12 installments so "7/24" (open all hours) is not read as a plan.
  { regex: /(?:^|[\s(])(\d{1,2})\/(\d{1,2})(?=$|[\s)])/, index: 1, count: 2, keyword: false },
];

/** Finds an installment marker such as "TAKSİT 3/6" or "3/6" in a description. */
export function parseInstallmentMarker(text: string): InstallmentMarker | null {
  return findMarker(foldText(text))?.marker ?? null;
}

/**
 * Reads a mapped installment column: "3/6", "03 / 06", "3 of 6". A lone number or
 * "1/1" is not a slice of a plan.
 */
export function parseInstallmentColumn(text: string): InstallmentMarker | null {
  const match = /^(\d{1,2})\s*(?:\/|\\|of)\s*(\d{1,2})$/.exec(foldText(text));
  if (!match) return null;
  const marker = { index: Number(match[1]), count: Number(match[2]), keyword: true };
  return valid(marker) ? marker : null;
}

/**
 * The description without its installment marker or the word "taksit", folded and
 * reduced to letters and digits, for matching plans.
 */
export function stripInstallmentMarker(text: string): string {
  const folded = foldText(text);
  const found = findMarker(folded);
  const rest = found ? folded.replace(found.match, ' ') : folded;
  return rest
    .replace(/\b(?:taksit|installment|instalment|inst)\w*\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function findMarker(folded: string): { marker: InstallmentMarker; match: string } | null {
  for (const pattern of PATTERNS) {
    const match = pattern.regex.exec(folded);
    if (!match) continue;
    const marker = {
      index: Number(match[pattern.index]),
      count: Number(match[pattern.count]),
      keyword: pattern.keyword,
    };
    if (valid(marker) && (pattern.keyword || marker.count <= MAX_BARE_COUNT)) {
      return { marker, match: match[0] };
    }
  }
  return null;
}

function valid({ index, count }: InstallmentMarker): boolean {
  return count >= 2 && count <= MAX_INSTALLMENTS && index >= 1 && index <= count;
}
