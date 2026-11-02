import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate, minorUnitDigits, type MonthAmount } from '../../core/finance';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import type { CurrencyCode, IsoMonth } from '../../types/domain';
import { Segmented } from '../ui/Segmented';

const RANGES = ['3', '6', '12'] as const;
type Range = (typeof RANGES)[number];

/**
 * Monthly credit card liabilities for the next 3, 6 or 12 months (D14). Colors come
 * from the theme tokens through CSS (index.css), so the chart follows light and dark.
 * A visually hidden table carries the same numbers for screen readers.
 */
export default function CashFlowChart({
  projections,
}: {
  projections: Readonly<Record<CurrencyCode, MonthAmount[]>>;
}) {
  const t = useT();
  const format = useFormat();
  const [range, setRange] = useState<Range>('6');
  const currencies = Object.keys(projections).sort((a, b) =>
    a === 'TRY' ? -1 : b === 'TRY' ? 1 : a.localeCompare(b),
  );
  const [picked, setPicked] = useState<CurrencyCode>();
  const currency = picked && currencies.includes(picked) ? picked : currencies[0];

  const data = (currency ? projections[currency]! : []).slice(0, Number(range));
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  const monthLabel = (month: IsoMonth, year = false) =>
    formatDate(
      `${month}-01`,
      format.locale,
      year ? { month: 'long', year: 'numeric' } : { month: 'short' },
    );

  return (
    <section aria-labelledby="cash-flow-title" className="space-y-3">
      <h2 id="cash-flow-title" className="text-sm font-medium text-muted">
        {t('dashboard.cashFlow.title')}
      </h2>
      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-muted">{t('dashboard.cashFlow.help')}</p>
        <Segmented
          label={t('dashboard.cashFlow.range')}
          options={RANGES.map((value) => ({
            value,
            label: t('dashboard.cashFlow.months', { count: value }),
          }))}
          value={range}
          onChange={setRange}
        />
        {currencies.length > 1 && (
          <Segmented
            label={t('dashboard.cashFlow.currency')}
            options={currencies.map((value) => ({ value, label: value }))}
            value={currency!}
            onChange={setPicked}
          />
        )}
        {!currency || total === 0 ? (
          <p className="text-sm text-muted">{t('dashboard.cashFlow.empty')}</p>
        ) : (
          <>
            <p className="font-semibold tabular-nums">
              {t('dashboard.cashFlow.total', {
                count: range,
                amount: format.money(total, currency),
              })}
            </p>
            <div className="cash-flow-chart h-48" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(month: IsoMonth) => monthLabel(month)}
                    tickLine={false}
                    axisLine={false}
                    // Every other month at 12 so the labels fit a phone screen.
                    interval={range === '12' ? 1 : 0}
                    fontSize={12}
                  />
                  <YAxis
                    width={56}
                    tickFormatter={(amount: number) =>
                      compactMoney(amount, currency, format.locale)
                    }
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <Tooltip
                    cursor={false}
                    content={({ active, payload }) => {
                      const item = payload?.[0]?.payload as MonthAmount | undefined;
                      if (!active || !item) return null;
                      return (
                        <div className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm shadow-lg">
                          <p className="text-muted">{monthLabel(item.month, true)}</p>
                          <p className="font-semibold tabular-nums">
                            {format.money(item.amount, currency)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="sr-only">
              <caption>{t('dashboard.cashFlow.title')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('dashboard.cashFlow.month')}</th>
                  <th scope="col">{t('dashboard.cashFlow.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.month}>
                    <th scope="row">{monthLabel(item.month, true)}</th>
                    <td>{format.money(item.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </section>
  );
}

/** Short axis labels such as "₺12K". Display only: no amount is computed from it. */
function compactMoney(amount: number, currency: CurrencyCode, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount / 10 ** minorUnitDigits(currency));
}
