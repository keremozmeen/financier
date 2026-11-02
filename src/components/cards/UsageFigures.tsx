import type { CardUsage } from '../../core/finance';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import type { Card } from '../../types/domain';
import { LEVEL_TEXT } from './colors';

/**
 * Used / available / limit figures. Amounts never truncate or overflow: when a row is
 * too narrow for label and amount side by side, the amount wraps under its label.
 */
export function UsageFigures({ card, usage }: { card: Card; usage: CardUsage }) {
  const t = useT();
  const format = useFormat();
  const rows = [
    { label: t('gauge.used'), value: usage.used, className: LEVEL_TEXT[usage.level] },
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
            {format.money(row.value, card.currency)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
