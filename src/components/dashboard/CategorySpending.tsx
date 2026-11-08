import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { CategoryTotal } from '../../core/categories';
import type { CurrencySpending } from '../../db';
import { useCategorySpending } from '../../hooks/useCategories';
import { useDetailedView } from '../../hooks/useDetailedView';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import { categoryKey } from '../categories/categoryDisplay';
import { Dialog } from '../ui/Dialog';

const TOP = 3;

/** One line with the month's top categories, opening the breakdown (D20, D22). */
export function CategorySpending() {
  const t = useT();
  const format = useFormat();
  const spending = useCategorySpending();
  const [open, setOpen] = useState(false);
  const shown = spending?.filter(({ months }) => months[0]!.totals.length > 0) ?? [];
  const first = shown[0];
  if (!first) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="panel flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t('dashboard.where.title')}</span>
          <span className="block text-sm text-muted">
            {first.months[0]!.totals.slice(0, TOP)
              .map(
                (total) =>
                  `${t(categoryKey({ main: total.main }, false))} ${format.money(total.amount, first.currency)}`,
              )
              .join(' · ')}
          </span>
        </span>
        <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-muted" />
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

function Breakdown({ spending: { currency, months } }: { spending: CurrencySpending }) {
  const t = useT();
  const format = useFormat();
  const [detailed] = useDetailedView();
  const totals = months[0]!.totals;

  return (
    <section className="space-y-4">
      <ul className="divide-y divide-border">
        {totals.map((total) => (
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
      {detailed && <Comparison currency={currency} months={months} />}
    </section>
  );
}

const hasSubs = (total: CategoryTotal) => total.subs.some(({ sub }) => sub);

/** Each category over the compared months, oldest first. */
function Comparison({ currency, months }: CurrencySpending) {
  const t = useT();
  const format = useFormat();
  const oldestFirst = [...months].reverse();
  const mains = [...new Set(months.flatMap(({ totals }) => totals.map((total) => total.main)))];

  return (
    <div>
      <h3 className="font-semibold">{t('dashboard.where.compare')}</h3>
      <ul className="mt-1 divide-y divide-border text-sm">
        {mains.map((main) => (
          <li key={main} className="py-2">
            <p className="font-medium">{t(categoryKey({ main }, false))}</p>
            <p className="text-muted">
              {oldestFirst
                .map(({ month, totals }) => {
                  const amount = totals.find((total) => total.main === main)?.amount ?? 0;
                  return `${format.month(month)} ${format.money(amount, currency)}`;
                })
                .join(' · ')}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
