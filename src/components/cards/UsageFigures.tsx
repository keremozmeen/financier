import type { CardUsage } from '../../core/finance';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import type { Card } from '../../types/domain';
import { LEVEL_TEXT } from './colors';

/** Used / available / limit figures next to a gauge. */
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
    <dl className="grid min-w-0 flex-1 gap-1.5 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">{row.label}</dt>
          <dd className={`truncate font-semibold tabular-nums ${row.className}`}>
            {format.money(row.value, card.currency)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
