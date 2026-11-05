import { parseStatementDate } from '../common/dates';
import { foldText } from '../common/text';

/** Labels a card statement prints above its rows, folded (D20). */
const STATEMENT_LABELS = [
  'hesap kesim tarihi',
  'ekstre kesim tarihi',
  'kesim tarihi',
  'ekstre tarihi',
  'statement date',
  'closing date',
];
const DUE_LABELS = ['son odeme tarihi', 'son odeme', 'payment due date', 'due date'];

export interface StatementCycle {
  statementDay?: number;
  dueDay?: number;
}

/**
 * The statement and due days a card statement states above its header row, such as
 * "Hesap Kesim Tarihi;10.10.2026" and "Son Ödeme Tarihi;20.10.2026" (D20). The value is
 * the next filled cell, or the text after a colon in the label's own cell. Only the day
 * of the month is kept: the card repeats it every month.
 */
export function readStatementCycle(rows: readonly string[][], headerRow: number): StatementCycle {
  const cycle: StatementCycle = {};
  for (const row of rows.slice(0, Math.max(headerRow, 0))) {
    row.forEach((cell, index) => {
      const [label = '', inline = ''] = cell.split(/:(.*)/s);
      const folded = foldText(label)
        .replace(/[^\p{L}\s]/gu, '')
        .trim();
      const value = inline.trim() || row.slice(index + 1).find((next) => next.trim()) || '';
      const day = dayOf(value);
      if (day === undefined) return;
      if (cycle.statementDay === undefined && STATEMENT_LABELS.includes(folded)) {
        cycle.statementDay = day;
      } else if (cycle.dueDay === undefined && DUE_LABELS.includes(folded)) {
        cycle.dueDay = day;
      }
    });
  }
  return cycle;
}

function dayOf(text: string): number | undefined {
  const date = parseStatementDate(text.trim());
  return date ? Number(date.slice(8, 10)) : undefined;
}
