import { Ban } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  isIsoDate,
  MAX_INSTALLMENTS,
  parseMoneyInput,
  splitInstallments,
  type SpendCheck,
  type SpendRequest,
} from '../../core/finance';
import type { ManualEntry } from '../../db';
import { useToday } from '../../hooks/useFinance';
import { useFormat } from '../../hooks/useFormat';
import { useI18n } from '../../i18n';
import type { Card } from '../../types/domain';
import { Button, ButtonLink } from '../ui/Button';
import { Segmented } from '../ui/Segmented';
import { SelectField, TextField } from '../ui/TextField';

type Entry = Omit<ManualEntry, 'card'>;
type Kind = Entry['kind'];

/** D12 for credit cards: whether the bank would accept a charge, and how to fix stale data. */
export interface SpendGuard {
  check: (request: SpendRequest) => SpendCheck;
  onUpdateBalance: () => void;
  editLimitTo: string;
}

export function TransactionForm({
  card,
  spendGuard,
  onSubmit,
  onCancel,
}: {
  card: Card;
  /** Credit cards only. Debit cards have no limit, so nothing is blocked (D13). */
  spendGuard?: SpendGuard;
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
  const [errors, setErrors] = useState<{ date?: string; amount?: string }>({});

  const parsedAmount = parseMoneyInput(amount, card.currency, locale);
  // Installments exist only on credit cards, and only for charges (D11, D13).
  const canSplit = card.type === 'credit' && kind === 'charge';
  const count = canSplit ? installments : 1;
  // An installment purchase is checked by its full total: the bank blocks all of it (D11).
  const spend: SpendCheck =
    spendGuard && parsedAmount
      ? spendGuard.check({ kind: kind === 'charge' ? 'charge' : 'refund', amount: parsedAmount })
      : { allowed: true };

  function submit(event: FormEvent) {
    event.preventDefault();
    // Only amount and date are required, so a quick entry is: amount → Save.
    const next = {
      date: isIsoDate(date) ? undefined : t('tx.error.date'),
      amount: parsedAmount ? undefined : t('tx.error.amount'),
    };
    setErrors(next);
    if (next.date || !parsedAmount || !spend.allowed) return;
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
      <TextField
        label={t('tx.field.amount')}
        error={errors.amount}
        value={amount}
        onChange={setAmount}
        inputMode="decimal"
        placeholder={locale === 'tr' ? '1.250,00' : '1,250.00'}
        autoComplete="off"
        // The amount is the only thing a quick entry needs, so it gets focus on open.
        autoFocus
        className="text-lg font-semibold"
      />
      <Segmented
        label={t('tx.kind')}
        value={kind}
        onChange={setKind}
        options={[
          { value: 'charge', label: t('tx.kind.charge') },
          { value: 'refund', label: t('tx.kind.refund') },
          // Money coming into the account; a credit card has no income (D17).
          ...(card.type === 'debit'
            ? [{ value: 'income' as const, label: t('tx.kind.income') }]
            : []),
        ]}
      />
      <TextField
        label={t('tx.field.description')}
        hint={t('common.optional')}
        value={description}
        onChange={setDescription}
        maxLength={80}
        autoComplete="off"
      />
      <TextField
        label={t('tx.field.date')}
        error={errors.date}
        type="date"
        value={date}
        onChange={setDate}
      />
      {canSplit && (
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
      {!spend.allowed && spendGuard && (
        <div role="alert" className="space-y-3 rounded-xl border border-alert/40 bg-alert/10 p-4">
          <p className="flex gap-2 text-sm font-medium">
            <Ban aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-alert" />
            {t('spend.blocked', { available: format.money(spend.available, card.currency) })}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={spendGuard.onUpdateBalance}>{t('spend.updateBalance')}</Button>
            <ButtonLink to={spendGuard.editLimitTo}>{t('spend.editLimit')}</ButtonLink>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary" disabled={!spend.allowed}>
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
