import type { CardUsage } from '../../core/finance';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import { LEVEL_TEXT } from './colors';

// A 270° arc drawn with pathLength=100, so dash lengths are percentages of the circle.
const ARC = 75;

/** Semi-circular limit gauge colored by utilization level (D4, D11). */
export function LimitGauge({
  usage,
  name,
  size = 128,
}: {
  usage: CardUsage;
  name: string;
  size?: number;
}) {
  const t = useT();
  const format = useFormat();
  const ratio = usage.utilization === null ? (usage.used > 0 ? 1 : 0) : usage.utilization;
  const filled = Math.min(Math.max(ratio, 0), 1) * ARC;
  const percent = usage.utilization === null ? '—' : format.percent(usage.utilization);

  return (
    <div
      role="meter"
      aria-label={t('gauge.label', { name, percent })}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      className={`relative shrink-0 ${LEVEL_TEXT[usage.level]}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 120 120" className="size-full" aria-hidden="true">
        <g transform="rotate(135 60 60)" fill="none" strokeWidth="10" strokeLinecap="round">
          <circle
            cx="60"
            cy="60"
            r="50"
            pathLength="100"
            strokeDasharray={`${ARC} 100`}
            className="stroke-border"
          />
          {filled > 0 && (
            <circle
              cx="60"
              cy="60"
              r="50"
              pathLength="100"
              strokeDasharray={`${filled} 100`}
              stroke="currentColor"
            />
          )}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
        <span className="text-2xl font-semibold tabular-nums">{percent}</span>
        <span className="text-xs text-muted">
          {usage.overLimit ? t('gauge.overLimit') : t('gauge.used')}
        </span>
      </div>
    </div>
  );
}
