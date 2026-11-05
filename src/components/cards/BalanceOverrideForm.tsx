import { useState, type FormEvent } from 'react';
import { isIsoDate, parseMoneyInput } from '../../core/finance';
import { useToday } from '../../hooks/useFinance';
import { useI18n } from '../../i18n';
import type { CreditCard, IsoDate } from '../../types/domain';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { TextField } from '../ui/TextField';

export function BalanceOverrideForm({
  card,
  onSubmit,
  onCancel,
}: {
  card: CreditCard;
  onSubmit: (balance: number, asOf: IsoDate) => void;
  onCancel: () => void;
}) {
  const { t, locale } = useI18n();
  const today = useToday();
  const [amount, setAmount] = useState('');
  const [asOf, setAsOf] = useState(today);
  const [isCredit, setIsCredit] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string; asOf?: string }>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const balance = parseMoneyInput(amount, card.currency, locale);
    const next = {
      amount: balance === null ? t('balance.error.amount') : undefined,
      asOf: !isIsoDate(asOf) || asOf > today ? t('balance.error.asOf') : undefined,
    };
    setErrors(next);
    if (balance === null || next.asOf) return;
    // A credit balance is stored as a negative balance (D15).
    onSubmit(isCredit ? -balance : balance, asOf);
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={t('balance.title')}
      className="space-y-4 panel p-4"
    >
      <h2 className="font-semibold">{t('balance.title')}</h2>
      <p className="text-sm text-muted">{t('balance.help')}</p>
      <TextField
        label={t('balance.field.amount')}
        error={errors.amount}
        value={amount}
        onChange={setAmount}
        inputMode="decimal"
        placeholder={locale === 'tr' ? '7.500,00' : '7,500.00'}
        autoComplete="off"
      />
      <Checkbox
        label={t('balance.field.credit')}
        hint={t('balance.field.credit.hint')}
        checked={isCredit}
        onChange={setIsCredit}
      />
      <TextField
        label={t('balance.field.asOf')}
        error={errors.asOf}
        type="date"
        value={asOf}
        max={today}
        onChange={setAsOf}
      />
      <div className="flex justify-end gap-2">
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
