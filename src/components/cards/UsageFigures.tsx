import type { CardUsage } from '../../core/finance';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import type { CreditCard } from '../../types/domain';
import { LEVEL_TEXT } from './colors';

/**
 * Used / available / limit figures. Amounts never truncate or overflow: when a row is
 * too narrow for label and amount side by side, the amount wraps under its label.
 */
export function UsageFigures({ card, usage }: { card: CreditCard; usage: CardUsage }) {
  const t = useT();
  const format = useFormat();
  const rows = [
    { label: t('gauge.used'), value: usage.used, className: LEVEL_TEXT[usage.level] },
    // A credit balance adds to what can be spent (D15).
    ...(usage.credit > 0
      ? [{ label: t('gauge.credit'), value: usage.credit, className: 'text-success', plus: true }]
      : []),
    {
      label: t('gauge.available'),
      value: usage.available,
      className: usage.overLimit ? 'text-alert' : '',
    },
    { label: t('gauge.limit'), value: card.limit, className: 'text-muted' },
  ];
  return (
    <dl className="grid w-full min-w-0 gap-2 text-sm">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5"
        >
          <dt className="text-muted">{row.label}</dt>
          <dd className={`font-semibold whitespace-nowrap tabular-nums ${row.className}`}>
            {'plus' in row && '+'}
            {format.money(row.value, card.currency)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
