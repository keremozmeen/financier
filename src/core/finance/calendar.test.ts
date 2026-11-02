import type { Card } from '../../types/domain';
import { buildDueDateCalendar } from './calendar';

const base = { bank: '', last4: '4821', currency: 'TRY', color: '', archived: false };
const credit = (id: string, name: string, dueDay: number): Card => ({
  ...base,
  id,
  name,
  type: 'credit',
  limit: 5_000_000,
  statementDay: 10,
  dueDay,
});
const labels = {
  summary: (name: string) => `${name} payment due`,
  description: 'Weekend due dates move to Monday.',
};
const now = new Date('2026-11-02T08:30:15.123Z');

function build(cards: Card[], today = '2026-11-02') {
  return buildDueDateCalendar(cards, today, now, labels);
}

const unfold = (ics: string) => ics.replace(/\r\n /g, '');

describe('buildDueDateCalendar (D5)', () => {
  it('writes one monthly all-day event per credit card with a 3-day alarm', () => {
    const ics = build([credit('bonus', 'Bonus', 20)]);
    expect(ics.split('\r\n')).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Financier//Due dates//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:due-bonus@financier.local',
      'DTSTAMP:20261102T083015Z',
      'DTSTART;VALUE=DATE:20261120',
      'DURATION:P1D',
      'RRULE:FREQ=MONTHLY;BYMONTHDAY=20',
      'SUMMARY:Bonus payment due',
      'DESCRIPTION:Weekend due dates move to Monday.',
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:-P3D',
      'DESCRIPTION:Bonus payment due',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ]);
  });

  it('leaves debit cards out and carries no amounts or card digits', () => {
    const debit: Card = { ...base, id: 'd', name: 'Maaş kartı', type: 'debit' };
    const ics = build([credit('a', 'Axess', 5), debit, credit('w', 'World', 15)]);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).not.toContain('Maaş');
    expect(ics).not.toContain('4821');
  });

  it('falls on the last day of shorter months for a 29th–31st due day', () => {
    const ics = build([credit('c', 'Card', 31)], '2026-02-10');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260228');
    expect(ics).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1');
    expect(build([credit('c', 'Card', 29)])).toContain(
      'RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29;BYSETPOS=-1',
    );
  });

  it('escapes text and folds long lines without splitting characters', () => {
    const name = 'Şirket; kartı, çok uzun bir isimle yazılmış ve satır sınırını aşan bir kart adı';
    const ics = build([credit('c', name, 5)]);
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(unfold(ics)).toContain(
      'SUMMARY:Şirket\\; kartı\\, çok uzun bir isimle yazılmış ve satır sınırını aşan bir kart adı payment due',
    );
  });

  it('is an empty calendar without credit cards', () => {
    expect(build([])).not.toContain('VEVENT');
  });
});
