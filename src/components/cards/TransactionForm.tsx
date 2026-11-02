import { useState, type FormEvent } from 'react';
import {
  isIsoDate,
  MAX_INSTALLMENTS,
  parseMoneyInput,
  splitInstallments,
} from '../../core/finance';
import type { ManualEntry } from '../../db';
import { useToday } from '../../hooks/useFinance';
import { useFormat } from '../../hooks/useFormat';
import { useI18n } from '../../i18n';
import type { Card } from '../../types/domain';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Segmented';
import { SelectField, TextField } from '../ui/TextField';

type Entry = Omit<ManualEntry, 'card'>;
type Kind = Entry['kind'];

export function TransactionForm({
  card,
  onSubmit,
  onCancel,
}: {
  card: Card;
  onSubmit: (entry: Entry) => void;
  onCancel: () => void;
}) {
  const { t, locale } = useI18n();
  const format = useFormat();
  const today = useToday();
  const [kind, setKind] = useState<Kind>('charge');
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [installments, setInstallments] = useState(1);
  const [errors, setErrors] = useState<{ date?: string; description?: string; amount?: string }>(
    {},
  );

  const parsedAmount = parseMoneyInput(amount, card.currency, locale);
  const count = kind === 'charge' ? installments : 1;

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = {
      date: isIsoDate(date) ? undefined : t('tx.error.date'),
      description: description.trim() ? undefined : t('tx.error.description'),
      amount: parsedAmount ? undefined : t('tx.error.amount'),
    };
    setErrors(next);
    if (next.date || next.description || !parsedAmount) return;
    onSubmit({
      kind,
      date,
      description: description.trim(),
      amount: parsedAmount,
      installments: count,
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Segmented
        label={t('tx.kind')}
        value={kind}
        onChange={setKind}
        options={[
          { value: 'charge', label: t('tx.kind.charge') },
          { value: 'refund', label: t('tx.kind.refund') },
        ]}
      />
      <TextField
        label={t('tx.field.description')}
        error={errors.description}
        value={description}
        onChange={setDescription}
        maxLength={80}
        autoComplete="off"
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t('tx.field.amount')}
          error={errors.amount}
          value={amount}
          onChange={setAmount}
          inputMode="decimal"
          placeholder={locale === 'tr' ? '1.250,00' : '1,250.00'}
          autoComplete="off"
        />
        <TextField
          label={t('tx.field.date')}
          error={errors.date}
          type="date"
          value={date}
          onChange={setDate}
        />
      </div>
      {kind === 'charge' && (
        <SelectField
          label={t('tx.field.installments')}
          value={String(installments)}
          onChange={(value) => setInstallments(Number(value))}
          hint={
            installments > 1 && parsedAmount
              ? installmentPreview(
                  parsedAmount,
                  installments,
                  (n) => format.money(n, card.currency),
                  t,
                )
              : undefined
          }
          options={Array.from({ length: MAX_INSTALLMENTS }, (_, i) => ({
            value: String(i + 1),
            label:
              i === 0 ? t('tx.installments.single') : t('tx.installments.count', { count: i + 1 }),
          }))}
        />
      )}
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

function installmentPreview(
  total: number,
  count: number,
  money: (amount: number) => string,
  t: ReturnType<typeof useI18n>['t'],
): string {
  const [first = 0, rest = 0] = splitInstallments(total, count);
  return first === rest
    ? t('tx.preview.even', { count, amount: money(rest) })
    : t('tx.preview.remainder', { first: money(first), rest: count - 1, amount: money(rest) });
}
