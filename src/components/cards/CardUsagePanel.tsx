import { TriangleAlert } from 'lucide-react';
import type { CardSummary } from '../../db';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import { LimitGauge } from './LimitGauge';
import { UsageFigures } from './UsageFigures';

/**
 * A card at a glance. Credit cards show the limit gauge plus figures, laid out by the
 * panel's own width (a container query): figures beside the gauge when there is room,
 * stacked under it when the card is narrow. Debit cards have no limit, so they show
 * this month's spending instead (D13).
 */
export function CardUsagePanel({
  summary,
  gaugeSize = 112,
}: {
  summary: CardSummary;
  gaugeSize?: number;
}) {
  const t = useT();
  const format = useFormat();

  if (!('usage' in summary)) {
    return (
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-sm text-muted">{t('debit.thisMonth')}</p>
        <p className="text-2xl font-semibold whitespace-nowrap tabular-nums">
          {format.money(summary.monthSpending, summary.card.currency)}
        </p>
      </div>
    );
  }

  const { card, usage } = summary;
  return (
    <div className="@container">
      <div className="flex flex-col items-center gap-4 @min-[23rem]:flex-row @min-[23rem]:gap-6">
        <LimitGauge usage={usage} name={card.name} size={gaugeSize} />
        <div className="w-full min-w-0 @min-[23rem]:flex-1">
          <UsageFigures card={card} usage={usage} />
        </div>
      </div>
      {usage.overLimit && (
        <p className="mt-3 flex gap-2 text-sm text-alert">
          <TriangleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          {t('cards.full.hint')}
        </p>
      )}
    </div>
  );
}
