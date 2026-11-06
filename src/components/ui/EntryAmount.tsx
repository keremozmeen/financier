import { displayAmount } from '../../core/finance';
import { useFormat } from '../../hooks/useFormat';
import type { CurrencyCode } from '../../types/domain';

/**
 * One entry's amount: spending plain, money in (refunds, income) with "+" in green.
 * `amount` uses the stored sign (money in is negative, D17). `label` is read by screen
 * readers before the amount where no visible "Income"/"Refund" text is shown nearby.
 */
export function EntryAmount({
  amount,
  currency,
  label,
  className = '',
}: {
  amount: number;
  currency: CurrencyCode;
  label?: string;
  className?: string;
}) {
  const format = useFormat();
  const moneyIn = displayAmount(amount).direction === 'in';
  return (
    <span
      className={`shrink-0 font-semibold tabular-nums ${moneyIn ? 'text-success' : ''} ${className}`}
    >
      {label && <span className="sr-only">{label}: </span>}
      {format.entry(amount, currency)}
    </span>
  );
}
