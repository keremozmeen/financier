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
import type { CurrencyCode } from '../../types/domain';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Segmented } from '../ui/Segmented';
import { SelectField, TextField } from '../ui/TextField';

export interface MappingResult {
  mapping: CsvMapping;
  options: CsvOptions;
  /** Save as a profile under this name (D3); undefined to not save. */
  profileName?: string;
}

const PREVIEW_ROWS = 5;
const HEADER_CHOICES = 15;

/** Step 2 of a CSV import: which column holds what, and how the file writes numbers and dates. */
export function MappingWizard({
  rows,
  currency,
  initial,
  defaultName,
  onSubmit,
  onCancel,
}: {
  rows: readonly string[][];
  currency: CurrencyCode;
  initial: { mapping: CsvMapping; options: CsvOptions };
  defaultName: string;
  onSubmit: (result: MappingResult) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const format = useFormat();
  const [mapping, setMapping] = useState(initial.mapping);
  const [options, setOptions] = useState(initial.options);
  const [save, setSave] = useState(true);
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string>();

  const header = rows[options.headerRow] ?? [];
  const width = Math.max(
    header.length,
    ...rows.slice(options.headerRow, options.headerRow + 10).map((r) => r.length),
  );
  const columns = Array.from({ length: width }, (_, i) => ({
    value: String(i),
    label: t('mapping.column', { n: i + 1, name: header[i] || '—' }),
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
    onSubmit({ mapping, options, ...(save && name.trim() ? { profileName: name.trim() } : {}) });
  }

  const preview = isCompleteMapping(mapping)
    ? extractRows(rows, mapping, options, currency).slice(0, PREVIEW_ROWS)
    : [];

  return (
    <form onSubmit={submit} noValidate aria-label={t('mapping.title')} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('mapping.title')}</h2>
        <p className="text-sm text-muted">{t('mapping.help')}</p>
      </div>
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
      <Segmented
        label={t('mapping.amountMode')}
        value={split ? 'split' : 'single'}
        onChange={setAmountMode}
        options={[
          { value: 'single', label: t('mapping.amountMode.single') },
          { value: 'split', label: t('mapping.amountMode.split') },
        ]}
      />
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
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={t('mapping.field.amount')}
            value={String(mapping.amount)}
            onChange={(v) => setColumn('amount', v)}
            options={columns}
          />
          <Segmented
            label={t('mapping.chargeSign')}
            value={options.chargeSign}
            onChange={(chargeSign) => setOptions((o) => ({ ...o, chargeSign }))}
            options={[
              { value: 'positive', label: t('mapping.chargeSign.positive') },
              { value: 'negative', label: t('mapping.chargeSign.negative') },
            ]}
          />
        </div>
      )}
      <SelectField
        label={t('mapping.field.installment')}
        value={String(mapping.installment ?? '')}
        onChange={(v) => setColumn('installment', v)}
        options={optional}
      />
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

      {preview.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-medium">{t('mapping.preview')}</h3>
          <table className="w-full table-fixed rounded-xl border border-border bg-surface text-sm">
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

      <Checkbox label={t('mapping.save')} checked={save} onChange={setSave} />
      {save && (
        <TextField
          label={t('mapping.profileName')}
          value={name}
          onChange={setName}
          maxLength={60}
        />
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
