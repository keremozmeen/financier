import { initials, matchBank } from '../../core/banks';
import type { Card } from '../../types/domain';
import { cardColor } from './colors';

const SIZES = { sm: 'size-8 text-[11px]', md: 'size-10 text-xs' } as const;

/**
 * The card's bank mark (D21): the known bank's mark on its brand color, else the
 * initials of the bank (or card name) on the card's color. Logos replace the marks
 * once their files are added.
 */
export function BankMark({
  card,
  size = 'md',
}: {
  card: Pick<Card, 'bank' | 'name' | 'color'>;
  size?: keyof typeof SIZES;
}) {
  const bank = matchBank(card.bank, card.name);
  const mark = bank?.mark ?? initials(card.bank || card.name);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-xl font-display font-bold tracking-tight ${SIZES[size]}`}
      style={{ backgroundColor: bank?.color ?? cardColor(card), color: bank?.ink ?? '#ffffff' }}
    >
      {mark}
    </span>
  );
}
