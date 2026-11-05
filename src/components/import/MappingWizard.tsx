import { ChevronDown } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  extractRows,
  guessMapping,
  guessOptions,
  isCompleteMapping,
  type CsvMapping,
  type CsvOptions,
} from '../../parsers/csv';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import type { CardType, CurrencyCode } from '../../types/domain';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Segmented';
import { SelectField } from '../ui/TextField';

export interface MappingResult {
  mapping: CsvMapping;
  options: CsvOptions;
}

const PREVIEW_ROWS = 5;
const HEADER_CHOICES = 15;

/**
 * Shown only when Financier can't read a file on its own (D16, D20): which column holds
 * the date, description and amount, by the file's own header names. Formats are detected
 * and stay folded unless the preview finds unreadable values.
 */
export function MappingWizard({
  rows,
  currency,
  cardType,
  initial,
  onSubmit,
  onCancel,
}: {
  rows: readonly string[][];
  currency: CurrencyCode;
  cardType: CardType;
  initial: { mapping: CsvMapping; options: CsvOptions };
  onSubmit: (result: MappingResult) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const format = useFormat();
  const [mapping, setMapping] = useState(initial.mapping);
  const [options, setOptions] = useState(initial.options);
  const [error, setError] = useState<string>();

  const header = rows[options.headerRow] ?? [];
  const width = Math.max(
    header.length,
    ...rows.slice(options.headerRow, options.headerRow + 10).map((r) => r.length),
  );
  const columns = Array.from({ length: width }, (_, i) => ({
    value: String(i),
    // The header's own name; a number only for a column without one.
    label: header[i]?.trim() || t('mapping.column', { n: i + 1 }),
  }));
  const optional = [{ value: '', label: t('mapping.none') }, ...columns];
  const split = mapping.amount === undefined;

  function pickHeader(value: string) {
    const headerRow = Number(value);
    const next = guessMapping(rows[headerRow] ?? [], rows.slice(headerRow + 1));
    setMapping(next);
    setOptions(guessOptions(rows, headerRow, next));
  }

  function setColumn(field: keyof CsvMapping, value: string) {
    setMapping((current) => {
      const next = { ...current };
      if (value === '') delete next[field];
      else next[field] = Number(value);
      return next;
    });
  }

  function setAmountMode(mode: 'single' | 'split') {
    setMapping(({ amount, debit, credit, ...rest }) =>
      mode === 'single'
        ? { ...rest, amount: amount ?? debit ?? 2 }
        : { ...rest, debit: debit ?? amount ?? 2, credit: credit ?? (amount ?? 2) + 1 },
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!isCompleteMapping(mapping)) {
      setError(t('mapping.error.columns'));
      return;
    }
    onSubmit({ mapping, options });
  }

  const parsed = isCompleteMapping(mapping) ? extractRows(rows, mapping, options, currency) : [];
  const preview = parsed.slice(0, PREVIEW_ROWS);
  // Formats open on their own when they are probably wrong.
  const unreadable = preview.some((row) => row.date === null || row.amount === null);

  return (
    <form onSubmit={submit} noValidate aria-label={t('mapping.title')} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('mapping.title')}</h2>
        <p className="text-sm text-muted">{t('mapping.help')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t('mapping.field.date')}
          value={String(mapping.date)}
          onChange={(v) => setColumn('date', v)}
          options={columns}
        />
        <SelectField
          label={t('mapping.field.description')}
          value={String(mapping.description)}
          onChange={(v) => setColumn('description', v)}
          options={columns}
        />
      </div>
      {split ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={t('mapping.field.debit')}
            value={String(mapping.debit ?? '')}
            onChange={(v) => setColumn('debit', v)}
            options={columns}
          />
          <SelectField
            label={t('mapping.field.credit')}
            value={String(mapping.credit ?? '')}
            onChange={(v) => setColumn('credit', v)}
            options={columns}
          />
        </div>
      ) : (
        <SelectField
          label={t('mapping.field.amount')}
          value={String(mapping.amount)}
          onChange={(v) => setColumn('amount', v)}
          options={columns}
        />
      )}
      {/* Debit cards have no installments (D13). */}
      {cardType === 'credit' && (
        <SelectField
          label={t('mapping.field.installment')}
          value={String(mapping.installment ?? '')}
          onChange={(v) => setColumn('installment', v)}
          options={optional}
        />
      )}
      <details className="group panel" open={unreadable}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="flex-1">{t('mapping.formats')}</span>
          <ChevronDown
            aria-hidden="true"
            size={16}
            className="shrink-0 text-muted transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="space-y-4 px-4 pb-4">
          <SelectField
            label={t('mapping.headerRow')}
            value={String(options.headerRow)}
            onChange={pickHeader}
            options={rows.slice(0, HEADER_CHOICES).map((row, i) => ({
              value: String(i),
              label: t('mapping.row', {
                n: i + 1,
                preview: row.filter(Boolean).join(' · ').slice(0, 60),
              }),
            }))}
          />
          <Segmented
            label={t('mapping.amountMode')}
            value={split ? 'split' : 'single'}
            onChange={setAmountMode}
            options={[
              { value: 'single', label: t('mapping.amountMode.single') },
              { value: 'split', label: t('mapping.amountMode.split') },
            ]}
          />
          {!split && (
            <Segmented
              label={t('mapping.chargeSign')}
              value={options.chargeSign}
              onChange={(chargeSign) => setOptions((o) => ({ ...o, chargeSign }))}
              options={[
                { value: 'positive', label: t('mapping.chargeSign.positive') },
                { value: 'negative', label: t('mapping.chargeSign.negative') },
              ]}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t('mapping.decimal')}
              value={options.decimal}
              onChange={(decimal) =>
                setOptions((o) => ({ ...o, decimal: decimal as CsvOptions['decimal'] }))
              }
              options={[
                { value: ',', label: t('mapping.decimal.comma') },
                { value: '.', label: t('mapping.decimal.dot') },
              ]}
            />
            <SelectField
              label={t('mapping.dateOrder')}
              value={options.dateOrder}
              onChange={(dateOrder) =>
                setOptions((o) => ({ ...o, dateOrder: dateOrder as CsvOptions['dateOrder'] }))
              }
              options={(['DMY', 'MDY', 'YMD'] as const).map((order) => ({
                value: order,
                label: t(`mapping.dateOrder.${order}`),
              }))}
            />
          </div>
        </div>
      </details>

      {preview.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-medium">{t('mapping.preview')}</h3>
          <table className="w-full table-fixed panel text-sm">
            <thead className="sr-only">
              <tr>
                <th>{t('mapping.field.date')}</th>
                <th>{t('mapping.field.description')}</th>
                <th>{t('mapping.field.amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {preview.map((row) => (
                <tr key={row.line}>
                  <td className="w-24 px-3 py-2 text-muted">
                    {row.date ? format.date(row.date) : t('mapping.unreadable')}
                  </td>
                  <td className="truncate px-1 py-2">{row.description}</td>
                  <td className="w-28 px-3 py-2 text-right tabular-nums">
                    {row.amount === null
                      ? t('mapping.unreadable')
                      : format.money(row.amount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary">
          {t('mapping.continue')}
        </Button>
      </div>
    </form>
  );
}
