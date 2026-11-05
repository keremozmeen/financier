import type { Card, IsoDate } from '../../types/domain';
import { dayOf, monthOf } from './dates';

export interface CalendarLabels {
  /** Event title for a card, e.g. "Bonus payment due". */
  summary: (cardName: string) => string;
  description: string;
}

/** Days before the due date the calendar reminds the user (D5). */
export const CALENDAR_ALARM_DAYS = 3;

/**
 * An iCalendar file with one monthly all-day event per credit card on its due day and a
 * reminder 3 days before (D5). Events carry only the card name: no amounts or card
 * digits, since phone calendars often sync to a cloud. Debit cards have no due date.
 * A 29th–31st due day falls on the last day of shorter months, like the app's dates.
 */
export function buildDueDateCalendar(
  cards: readonly Card[],
  today: IsoDate,
  now: Date,
  labels: CalendarLabels,
): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const events = cards.flatMap((card) => {
    // Debit cards have no due date, and a credit card has none until its days are known.
    if (card.type !== 'credit' || card.dueDay === undefined) return [];
    const start = dayOf(monthOf(today), card.dueDay).replace(/-/g, '');
    return [
      'BEGIN:VEVENT',
      `UID:due-${card.id}@financier.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      'DURATION:P1D',
      `RRULE:${monthlyRule(card.dueDay)}`,
      `SUMMARY:${escapeText(labels.summary(card.name))}`,
      `DESCRIPTION:${escapeText(labels.description)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `TRIGGER:-P${CALENDAR_ALARM_DAYS}D`,
      `DESCRIPTION:${escapeText(labels.summary(card.name))}`,
      'END:VALARM',
      'END:VEVENT',
    ];
  });
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Financier//Due dates//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** Monthly on `day`, or on the month's last day when it is shorter (BYSETPOS picks the latest). */
function monthlyRule(day: number): string {
  if (day <= 28) return `FREQ=MONTHLY;BYMONTHDAY=${day}`;
  const days = Array.from({ length: day - 27 }, (_, i) => 28 + i).join(',');
  return `FREQ=MONTHLY;BYMONTHDAY=${days};BYSETPOS=-1`;
}

/** RFC 5545 TEXT escaping. */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Folds lines longer than 75 octets without splitting a UTF-8 character (RFC 5545 3.1). */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // Continuation lines start with a space, which counts toward their 75 octets.
    const max = parts.length === 0 ? 75 : 74;
    if (size + bytes > max) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}
