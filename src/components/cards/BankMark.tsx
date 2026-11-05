import { CreditCard, Wallet } from 'lucide-react';
import { matchBank } from '../../core/banks';
import type { Card } from '../../types/domain';
import { cardColor } from './colors';

const SIZES = {
  sm: { box: 'size-8 text-[11px]', icon: 16 },
  md: { box: 'size-10 text-xs', icon: 20 },
} as const;

/**
 * The card's mark (D21): a known bank's initials on its brand color. Otherwise a simple
 * outline of the card type on the card's color: a card for credit, a wallet for debit
 * (the debit card stands for its bank account, D17). No logo files are used.
 */
export function BankMark({
  card,
  size = 'md',
}: {
  card: Pick<Card, 'bank' | 'name' | 'color' | 'type'>;
  size?: keyof typeof SIZES;
}) {
  const bank = matchBank(card.bank, card.name);
  const { box, icon } = SIZES[size];
  const Icon = card.type === 'debit' ? Wallet : CreditCard;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-xl font-display font-bold tracking-tight ${box}`}
      style={{ backgroundColor: bank?.color ?? cardColor(card), color: bank?.ink ?? '#ffffff' }}
    >
      {bank ? bank.mark : <Icon size={icon} strokeWidth={1.75} />}
    </span>
  );
}
