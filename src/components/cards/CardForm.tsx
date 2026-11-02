import { CalendarDays, Info } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  formatMoneyInput,
  nextStatementDates,
  parseMoneyInput,
  SUPPORTED_CURRENCIES,
} from '../../core/finance';
import type { CardInput } from '../../db';
import { useToday } from '../../hooks/useFinance';
import { useFormat } from '../../hooks/useFormat';
import { useI18n, type MessageKey } from '../../i18n';
import type { Card, CardType } from '../../types/domain';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Segmented } from '../ui/Segmented';
import { SelectField, TextField } from '../ui/TextField';
import { CARD_COLORS, DEFAULT_CARD_COLOR } from './colors';

interface CardFormProps {
  initial?: Card;
  /**
   * Type and currency are fixed once a card has entries: usage only counts the card's
   * currency, and debit entries have no installments (D13).
   */
  hasEntries?: boolean;
  onSubmit: (input: CardInput) => void;
  onCancel: () => void;
}

type Errors = Partial<Record<'name' | 'last4' | 'limit' | 'statementDay' | 'dueDay', string>>;

function parseDay(value: string): number | null {
  const day = Number(value.trim());
  return /^\d{1,2}$/.test(value.trim()) && day >= 1 && day <= 31 ? day : null;
}

export function CardForm({ initial, hasEntries = false, onSubmit, onCancel }: CardFormProps) {
  const { t, locale } = useI18n();
  const credit = initial?.type === 'credit' ? initial : undefined;
  const [type, setType] = useState<CardType>(initial?.type ?? 'credit');
  const [name, setName] = useState(initial?.name ?? '');
  const [bank, setBank] = useState(initial?.bank ?? '');
  const [last4, setLast4] = useState(initial?.last4 ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'TRY');
  const [limit, setLimit] = useState(
    credit ? formatMoneyInput(credit.limit, credit.currency, locale) : '',
  );
  const [statementDay, setStatementDay] = useState(String(credit?.statementDay ?? ''));
  const [dueDay, setDueDay] = useState(String(credit?.dueDay ?? ''));
  const [color, setColor] = useState(initial?.color ?? DEFAULT_CARD_COLOR);
  const [autoPay, setAutoPay] = useState(credit?.autoPay ?? false);
  const today = useToday();
  const [errors, setErrors] = useState<Errors>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const common = { name: name.trim(), bank: bank.trim(), last4, currency, color };
    const next: Errors = {};
    if (!common.name) next.name = t('cards.error.name');
    if (last4 && !/^\d{4}$/.test(last4)) next.last4 = t('cards.error.last4');

    if (type === 'debit') {
      setErrors(next);
      if (Object.keys(next).length === 0) onSubmit({ ...common, type: 'debit' });
      return;
    }

    const parsedLimit = parseMoneyInput(limit, currency, locale);
    const parsedStatement = parseDay(statementDay);
    const parsedDue = parseDay(dueDay);
    if (!parsedLimit) next.limit = t('cards.error.limit');
    if (!parsedStatement) next.statementDay = t('cards.error.day');
    if (!parsedDue) next.dueDay = t('cards.error.day');
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsedLimit || !parsedStatement || !parsedDue) return;
    onSubmit({
      ...common,
      type: 'credit',
      limit: parsedLimit,
      statementDay: parsedStatement,
      dueDay: parsedDue,
      // Auto-pay counts from the day it is turned on; keep that day while it stays on (D14).
      ...(autoPay
        ? { autoPay: true, autoPaySince: (credit?.autoPay && credit.autoPaySince) || today }
        : {}),
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-1">
        <Segmented
          label={t('cards.type')}
          value={type}
          onChange={setType}
          options={[
            { value: 'credit', label: t('cards.type.credit') },
            { value: 'debit', label: t('cards.type.debit') },
          ]}
          disabled={hasEntries}
        />
        {hasEntries && <p className="text-xs text-muted">{t('cards.type.locked')}</p>}
        {type === 'debit' && <p className="text-xs text-muted">{t('debit.note')}</p>}
      </div>
      <TextField
        label={t('cards.field.name')}
        hint={t('cards.field.name.hint')}
        error={errors.name}
        value={name}
        onChange={setName}
        maxLength={40}
        autoComplete="off"
      />
      <TextField
        label={t('cards.field.bank')}
        hint={t('common.optional')}
        value={bank}
        onChange={setBank}
        maxLength={40}
        autoComplete="off"
      />
      {type === 'credit' ? (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t('cards.field.last4')}
            hint={t('common.optional')}
            error={errors.last4}
            value={last4}
            onChange={(value) => setLast4(value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            autoComplete="off"
          />
          <SelectField
            label={t('cards.field.currency')}
            value={currency}
            onChange={setCurrency}
            disabled={hasEntries}
            hint={hasEntries ? t('cards.field.currency.locked') : undefined}
            options={SUPPORTED_CURRENCIES.map((code) => ({ value: code, label: code }))}
          />
        </div>
      ) : (
        <TextField
          label={t('cards.field.last4')}
          hint={t('common.optional')}
          error={errors.last4}
          value={last4}
          onChange={(value) => setLast4(value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          autoComplete="off"
        />
      )}
      {type === 'credit' && (
        <>
          <TextField
            label={t('cards.field.limit')}
            error={errors.limit}
            value={limit}
            onChange={setLimit}
            inputMode="decimal"
            placeholder={locale === 'tr' ? '50.000,00' : '50,000.00'}
            autoComplete="off"
          />
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label={t('cards.field.statementDay')}
                hint={t('cards.field.day.hint')}
                error={errors.statementDay}
                value={statementDay}
                onChange={setStatementDay}
                inputMode="numeric"
                maxLength={2}
              />
              <TextField
                label={t('cards.field.dueDay')}
                hint={t('cards.field.day.hint')}
                error={errors.dueDay}
                value={dueDay}
                onChange={setDueDay}
                inputMode="numeric"
                maxLength={2}
              />
            </div>
            <StatementPreview statementDay={statementDay} dueDay={dueDay} />
          </div>
          <Checkbox
            label={t('cards.field.autoPay')}
            hint={t('cards.field.autoPay.hint')}
            checked={autoPay}
            onChange={setAutoPay}
          />
        </>
      )}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('cards.field.color')}</legend>
        <div className="flex flex-wrap gap-2">
          {CARD_COLORS.map((option, index) => (
            <label
              key={option}
              className="relative inline-flex size-11 cursor-pointer items-center justify-center rounded-full has-checked:ring-2 has-checked:ring-fg has-focus-visible:ring-2 has-focus-visible:ring-accent"
            >
              <input
                type="radio"
                name="card-color"
                value={option}
                checked={color === option}
                onChange={() => setColor(option)}
                aria-label={t(`color.${index}` as MessageKey)}
                className="sr-only"
              />
              <span className="size-8 rounded-full" style={{ backgroundColor: option }} />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary">
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

/** Live "Next statement · Payment due" preview, plus a soft hint when the days are equal. */
function StatementPreview({ statementDay, dueDay }: { statementDay: string; dueDay: string }) {
  const { t } = useI18n();
  const format = useFormat();
  const today = useToday();
  const statement = parseDay(statementDay);
  const due = parseDay(dueDay);

  return (
    <div aria-live="polite" className="space-y-1 text-sm">
      {statement && due && (
        <>
          <p className="flex gap-2 rounded-lg bg-surface-raised px-3 py-2">
            <CalendarDays aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-muted" />
            <span>
              {(() => {
                const dates = nextStatementDates(today, statement, due);
                return t('cards.preview', {
                  statement: format.date(dates.statementDate),
                  due: format.date(dates.dueDate),
                });
              })()}
            </span>
          </p>
          {statement === due && (
            <p className="flex gap-2 px-3 text-muted">
              <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
              {t('cards.sameDayHint')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
