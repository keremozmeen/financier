import { TriangleAlert } from 'lucide-react';
import type { CardUsage } from '../../core/finance';
import { useT } from '../../i18n';
import type { Card } from '../../types/domain';
import { LimitGauge } from './LimitGauge';
import { UsageFigures } from './UsageFigures';

/**
 * Gauge plus figures, laid out by the panel's own width (a container query), so it
 * works the same in the dashboard grid and on the card screen: figures sit beside the
 * gauge when there is room and stack under it when the card is narrow.
 */
export function CardUsagePanel({
  card,
  usage,
  gaugeSize = 112,
}: {
  card: Card;
  usage: CardUsage;
  gaugeSize?: number;
}) {
  const t = useT();
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
