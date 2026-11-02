import { useState, type FormEvent } from 'react';
import { formatMoneyInput, parseMoneyInput, SUPPORTED_CURRENCIES } from '../../core/finance';
import type { CardInput } from '../../db';
import { useI18n, type MessageKey } from '../../i18n';
import type { Card } from '../../types/domain';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/TextField';
import { CARD_COLORS, DEFAULT_CARD_COLOR } from './colors';

interface CardFormProps {
  initial?: Card;
  /** The currency is fixed once a card has entries, because usage only counts its currency. */
  currencyLocked?: boolean;
  onSubmit: (input: CardInput) => void;
  onCancel: () => void;
}

type Errors = Partial<Record<'name' | 'last4' | 'limit' | 'statementDay' | 'dueDay', string>>;

function parseDay(value: string): number | null {
  const day = Number(value);
  return /^\d{1,2}$/.test(value) && day >= 1 && day <= 31 ? day : null;
}

export function CardForm({ initial, currencyLocked = false, onSubmit, onCancel }: CardFormProps) {
  const { t, locale } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [bank, setBank] = useState(initial?.bank ?? '');
  const [last4, setLast4] = useState(initial?.last4 ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'TRY');
  const [limit, setLimit] = useState(
    initial ? formatMoneyInput(initial.limit, initial.currency, locale) : '',
  );
  const [statementDay, setStatementDay] = useState(String(initial?.statementDay ?? ''));
  const [dueDay, setDueDay] = useState(String(initial?.dueDay ?? ''));
  const [color, setColor] = useState(initial?.color ?? DEFAULT_CARD_COLOR);
  const [errors, setErrors] = useState<Errors>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedLimit = parseMoneyInput(limit, currency, locale);
    const parsedStatement = parseDay(statementDay.trim());
    const parsedDue = parseDay(dueDay.trim());
    const next: Errors = {};
    if (!name.trim()) next.name = t('cards.error.name');
    if (last4 && !/^\d{4}$/.test(last4)) next.last4 = t('cards.error.last4');
    if (!parsedLimit) next.limit = t('cards.error.limit');
    if (!parsedStatement) next.statementDay = t('cards.error.day');
    if (!parsedDue) next.dueDay = t('cards.error.day');
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsedLimit || !parsedStatement || !parsedDue) return;

    onSubmit({
      name: name.trim(),
      bank: bank.trim(),
      last4,
      currency,
      limit: parsedLimit,
      statementDay: parsedStatement,
      dueDay: parsedDue,
      color,
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
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
          disabled={currencyLocked}
          hint={currencyLocked ? t('cards.field.currency.locked') : undefined}
          options={SUPPORTED_CURRENCIES.map((code) => ({ value: code, label: code }))}
        />
      </div>
      <TextField
        label={t('cards.field.limit')}
        error={errors.limit}
        value={limit}
        onChange={setLimit}
        inputMode="decimal"
        placeholder={locale === 'tr' ? '50.000,00' : '50,000.00'}
        autoComplete="off"
      />
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
