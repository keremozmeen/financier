import { useState, type FormEvent } from 'react';
import { formatMoneyInput, isIsoDate, parseMoneyInput, type Bill } from '../../core/finance';
import { useToday } from '../../hooks/useFinance';
import { useFormat } from '../../hooks/useFormat';
import { useI18n } from '../../i18n';
import type { CreditCard, IsoDate } from '../../types/domain';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';

/** Records a bill payment, prefilled with what is left of the statement (D14). */
export function PaymentForm({
  card,
  bill,
  onSubmit,
  onCancel,
}: {
  card: CreditCard;
  bill: Bill;
  onSubmit: (amount: number, date: IsoDate) => void;
  onCancel: () => void;
}) {
  const { t, locale } = useI18n();
  const format = useFormat();
  const today = useToday();
  const [amount, setAmount] = useState(() =>
    formatMoneyInput(bill.remaining, card.currency, locale),
  );
  const [date, setDate] = useState(today);
  const [errors, setErrors] = useState<{ amount?: string; date?: string }>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const paid = parseMoneyInput(amount, card.currency, locale);
    const next = {
      amount: paid === null || paid <= 0 ? t('payment.error.amount') : undefined,
      date: !isIsoDate(date) || date > today ? t('payment.error.date') : undefined,
    };
    setErrors(next);
    if (paid === null || next.amount || next.date) return;
    onSubmit(paid, date);
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={t('payment.title')}
      className="space-y-4 rounded-xl border border-border bg-surface p-4"
    >
      <h2 className="font-semibold">{t('payment.title')}</h2>
      <p className="text-sm">
        {t('payment.statementTotal', { amount: format.money(bill.total, card.currency) })}
      </p>
      <p className="text-sm text-muted">{t('payment.help')}</p>
      <TextField
        label={t('payment.field.amount')}
        error={errors.amount}
        value={amount}
        onChange={setAmount}
        inputMode="decimal"
        autoComplete="off"
      />
      <TextField
        label={t('payment.field.date')}
        error={errors.date}
        type="date"
        value={date}
        max={today}
        onChange={setDate}
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
