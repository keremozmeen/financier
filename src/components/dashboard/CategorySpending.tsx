import { useState } from 'react';
import {
  CHART_CATEGORIES,
  chartSlices,
  inRingOrder,
  type CategoryTotal,
  type ChartSlice,
  type ChartSliceKey,
} from '../../core/categories';
import type { CurrencySpending } from '../../db';
import { useCategorySpending } from '../../hooks/useCategories';
import { useDetailedView } from '../../hooks/useDetailedView';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import { categoryKey } from '../categories/categoryDisplay';
import { Dialog } from '../ui/Dialog';

const SIMPLE_SLICES = 3;
const MONTH_BAR_HEIGHT = 96;

const sliceColor = (key: ChartSliceKey) => {
  const slot = (CHART_CATEGORIES as readonly string[]).indexOf(key);
  return slot >= 0 ? `var(--series-${slot + 1})` : `var(--series-${key})`;
};

const sum = (slices: readonly ChartSlice[]) =>
  slices.reduce((total, slice) => total + slice.amount, 0);

/** The month's spending as a chart that opens the full list (D20, D22). */
export function CategorySpending() {
  const t = useT();
  const format = useFormat();
  const [detailed] = useDetailedView();
  const spending = useCategorySpending();
  const [open, setOpen] = useState(false);
  const shown = spending?.filter(({ months }) => months[0]!.totals.length > 0) ?? [];
  const first = shown[0];
  if (!first) return null;

  const slices = chartSlices(first.months[0]!.totals, detailed ? undefined : SIMPLE_SLICES);
  const total = sum(slices);
  const name = (key: ChartSliceKey) =>
    t(key === 'rest' ? 'dashboard.where.rest' : categoryKey({ main: key }, false));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="panel block w-full p-4 text-left"
      >
        <span className="block font-semibold">{t('dashboard.where.title')}</span>
        <span className="mt-3 flex items-center gap-4">
          <Donut slices={slices} total={format.money(total, first.currency)} />
          <span className="min-w-0 flex-1 space-y-1 text-sm">
            {slices.map((slice) => (
              <span key={slice.key} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: sliceColor(slice.key) }}
                />
                <span className="min-w-0 flex-1 truncate">{name(slice.key)}</span>
                <span className="shrink-0 tabular-nums">
                  {detailed
                    ? format.money(slice.amount, first.currency)
                    : format.percent(slice.amount / total)}
                </span>
              </span>
            ))}
          </span>
        </span>
        {detailed && <MonthBars spending={first} />}
      </button>
      {open && (
        <Dialog title={t('dashboard.where.title')} onClose={() => setOpen(false)}>
          <div className="space-y-5">
            {shown.map((item) => (
              <Breakdown key={item.currency} spending={item} />
            ))}
          </div>
        </Dialog>
      )}
    </>
  );
}

/** A donut with the month's total in the middle. The legend beside it names the slices. */
function Donut({ slices, total }: { slices: readonly ChartSlice[]; total: string }) {
  const whole = sum(slices);
  const ring = inRingOrder(slices);
  const arcs = ring.map((slice, index) => ({
    slice,
    share: (slice.amount / whole) * 100,
    start: (sum(ring.slice(0, index)) / whole) * 100,
  }));
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className="size-28 shrink-0">
      <g fill="none" strokeWidth="13" transform="rotate(-90 50 50)">
        {arcs.map(({ slice, share, start }) => (
          <circle
            key={slice.key}
            cx="50"
            cy="50"
            r="40"
            pathLength={100}
            stroke={sliceColor(slice.key)}
            strokeDasharray={`${Math.max(share, 0.5)} 100`}
            strokeDashoffset={-start}
          />
        ))}
      </g>
      <text
        x="50"
        y="54"
        textAnchor="middle"
        className="fill-fg font-semibold tabular-nums"
        fontSize={total.length > 9 ? 9 : 11}
      >
        {total}
      </text>
    </svg>
  );
}

/** The last months as stacked bars, oldest first, in the same colors as the donut. */
function MonthBars({ spending: { currency, months } }: { spending: CurrencySpending }) {
  const t = useT();
  const format = useFormat();
  const columns = [...months].reverse().map(({ month, totals }) => {
    const slices = chartSlices(totals);
    return { month, slices, total: sum(slices) };
  });
  const tallest = Math.max(...columns.map((column) => column.total));

  return (
    <span className="mt-4 block border-t border-border pt-3">
      <span className="block text-sm font-semibold">{t('dashboard.where.compare')}</span>
      <span className="mt-2 flex items-end justify-around">
        {columns.map(({ month, slices, total }) => (
          <span key={month} className="flex w-20 flex-col items-center gap-1">
            {total > 0 && (
              <span className="text-xs tabular-nums">{format.money(total, currency)}</span>
            )}
            <span className="flex w-6 flex-col overflow-hidden rounded-t">
              {inRingOrder(slices)
                .reverse()
                .map((slice) => (
                  <span
                    key={slice.key}
                    className="block"
                    style={{
                      height: Math.max((slice.amount / tallest) * MONTH_BAR_HEIGHT, 1),
                      backgroundColor: sliceColor(slice.key),
                    }}
                  />
                ))}
            </span>
            <span className="text-xs">{format.month(month)}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

function Breakdown({ spending: { currency, months } }: { spending: CurrencySpending }) {
  const t = useT();
  const format = useFormat();
  const [detailed] = useDetailedView();

  return (
    <ul className="divide-y divide-border">
      {months[0]!.totals.map((total) => (
        <li key={total.main} className="py-2">
          <p className="flex justify-between gap-3 font-medium">
            <span>{t(categoryKey({ main: total.main }, false))}</span>
            <span className="tabular-nums">{format.money(total.amount, currency)}</span>
          </p>
          {detailed && hasSubs(total) && (
            <ul className="mt-1 space-y-0.5 text-sm text-muted">
              {total.subs.map(({ sub, amount }) => (
                <li key={sub ?? ''} className="flex justify-between gap-3 pl-3">
                  <span>
                    {sub
                      ? t(categoryKey({ main: total.main, sub }, true))
                      : t('dashboard.where.general')}
                  </span>
                  <span className="tabular-nums">{format.money(amount, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

const hasSubs = (total: CategoryTotal) => total.subs.some(({ sub }) => sub);
