import { Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatMoneyInput, isIsoDate, parseMoneyInput } from '../../core/finance';
import {
  countOutcomes,
  editDraft,
  planImport,
  signedAmount,
  type DraftRow,
  type ImportContext,
  type PlannedRow,
  type RowOutcome,
} from '../../core/import';
import { parseInstallmentColumn, rowTypesFor, type ImportRowType } from '../../parsers/common';
import { useFormat } from '../../hooks/useFormat';
import { useI18n, type MessageKey } from '../../i18n';
import type { Card, CreditCard, StatementKind } from '../../types/domain';
import { Button } from '../ui/Button';
import { inputClass, TextField } from '../ui/TextField';

/** Step 3 of an import: every row with its type, outcome and confidence (D3, D16). */
export function ReviewList({
  card,
  statement,
  drafts,
  context,
  onChange,
  onImport,
  busy,
}: {
  card: Card;
  statement: StatementKind;
  drafts: readonly DraftRow[];
  context: ImportContext;
  onChange: (drafts: DraftRow[]) => void;
  onImport: () => void;
  busy: boolean;
}) {
  const { t } = useI18n();
  const planned = useMemo(() => planImport(drafts, context), [drafts, context]);
  const counts = countOutcomes(planned);
  const planNames = new Map(context.plans.map((plan) => [plan.id, plan.description]));
  const creditCards = (context.creditCards ?? []).map((c) => c.card);
  const skipped = counts.skip + counts.duplicate + counts.paymentRecorded + counts.dropped;

  const update = (index: number, patch: Partial<DraftRow>) =>
    onChange(drafts.map((row, i) => (i === index ? editDraft(row, patch) : row)));

  const chips: [MessageKey, number][] = [
    ['review.count.add', counts.add],
    ['review.count.merge', counts.merge],
    ['review.count.link', counts.link],
    ['review.count.newPlan', counts.newPlan],
    ['review.count.payment', counts.payment],
    ['review.count.skipped', skipped],
    ['review.count.invalid', counts.invalid],
  ];

  return (
    <section aria-labelledby="review-title" className="space-y-4">
      <div>
        <h2 id="review-title" className="text-lg font-semibold">
          {t('review.title')}
        </h2>
        <p className="text-sm text-muted">{t('review.help')}</p>
      </div>
      <ul aria-label={t('review.title')} className="flex flex-wrap gap-2 text-sm">
        {chips
          .filter(([, count]) => count > 0)
          .map(([key, count]) => (
            <li
              key={key}
              className={`rounded-full px-3 py-1 ${
                key === 'review.count.invalid' ? 'bg-alert/15 text-alert' : 'bg-surface-raised'
              }`}
            >
              {t(key, { count })}
            </li>
          ))}
      </ul>
      {drafts.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-4 text-muted">
          {t('review.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {planned.map((item, i) => (
            <ReviewRow
              key={item.row.line}
              card={card}
              statement={statement}
              creditCards={creditCards}
              item={item}
              planName={(id) => planNames.get(id) || t('tx.fallback.installment')}
              onChange={(patch) => update(i, patch)}
            />
          ))}
        </ul>
      )}
      <div className="flex justify-end">
        <Button variant="primary" onClick={onImport} disabled={busy || drafts.length === 0}>
          {t('review.import')}
        </Button>
      </div>
    </section>
  );
}

function ReviewRow({
  card,
  statement,
  creditCards,
  item: { row, outcome },
  planName,
  onChange,
}: {
  card: Card;
  statement: StatementKind;
  creditCards: readonly CreditCard[];
  item: PlannedRow;
  planName: (id: string) => string;
  onChange: (patch: Partial<DraftRow>) => void;
}) {
  const { t } = useI18n();
  const format = useFormat();
  const [editing, setEditing] = useState(false);
  const types = rowTypesFor(card.type, statement);
  const credit = row.type === 'refund' || row.type === 'income';
  // A bill payment from a debit account is recorded on a credit card (D17).
  const pickCard = card.type === 'debit' && row.type === 'payment' && creditCards.length > 0;
  const paidCard =
    outcome.kind === 'payment' ? creditCards.find((c) => c.id === outcome.cardId) : undefined;
  const label = row.description || t('tx.fallback.charge');

  return (
    <li className={`space-y-2 px-3 py-3 ${row.dropped ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-2">
        <label className="-m-2 flex size-11 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={!row.dropped}
            onChange={(event) => onChange({ dropped: !event.target.checked })}
            aria-label={t('review.include', { line: row.line })}
            className="size-5 accent-accent"
          />
        </label>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{label}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span>{row.date ? format.date(row.date) : t('mapping.unreadable')}</span>
            <span>{t('review.row', { line: row.line })}</span>
            {row.confidence !== 'high' && (
              <span className="rounded bg-warn/15 px-1.5 py-0.5 text-warn">
                {t(row.confidence === 'low' ? 'review.confidence.low' : 'review.confidence.medium')}
              </span>
            )}
          </p>
        </div>
        <span className={`shrink-0 font-semibold tabular-nums ${credit ? 'text-success' : ''}`}>
          {row.amount === null
            ? t('mapping.unreadable')
            : format.money(signedAmount(row), card.currency)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-9">
        <select
          value={row.type}
          onChange={(event) => onChange({ type: event.target.value as ImportRowType })}
          aria-label={t('review.type', { line: row.line })}
          className={`${inputClass} w-auto min-w-36 text-sm`}
        >
          {types.map((type) => (
            <option key={type} value={type}>
              {t(`review.type.${type}`)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setEditing((open) => !open)}
          aria-expanded={editing}
          aria-label={t('review.edit', { line: row.line })}
          className="inline-flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-raised hover:text-fg"
        >
          <Pencil aria-hidden="true" size={16} />
        </button>
        {pickCard && (
          <select
            value={
              outcome.kind === 'payment' || outcome.kind === 'paymentRecorded'
                ? outcome.cardId
                : (row.targetCardId ?? '')
            }
            onChange={(event) => onChange({ targetCardId: event.target.value || undefined })}
            aria-label={t('review.payCard', { line: row.line })}
            className={`${inputClass} w-auto min-w-36 text-sm`}
          >
            <option value="">{t('review.pickCard')}</option>
            {creditCards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.last4 ? `${c.name} ·${c.last4}` : c.name}
              </option>
            ))}
          </select>
        )}
        {row.type === 'transfer' && (
          <Button
            variant="ghost"
            onClick={() => onChange({ countAsSpending: !row.countAsSpending })}
          >
            {t(row.countAsSpending ? 'review.dontCount' : 'review.countAsSpending')}
          </Button>
        )}
        {outcome.kind === 'merge' && (
          <Button variant="ghost" onClick={() => onChange({ unmerged: true })}>
            {t('review.unmerge')}
          </Button>
        )}
        {outcome.kind === 'add' && outcome.manualMatch && (
          <Button variant="ghost" onClick={() => onChange({ unmerged: false })}>
            {t('review.merge')}
          </Button>
        )}
      </div>
      <p className={`pl-9 text-sm ${OUTCOME_TONE[outcome.kind]}`}>
        {outcomeText(outcome, t, format, card, planName, paidCard)}
      </p>
      {editing && <RowEditor card={card} row={row} onChange={onChange} />}
    </li>
  );
}

const ADD_TEXT: Record<'none' | 'fee' | 'income' | 'bill' | 'transfer', MessageKey> = {
  none: 'review.outcome.add',
  fee: 'review.outcome.addFee',
  income: 'review.outcome.addIncome',
  bill: 'review.outcome.addBill',
  transfer: 'review.outcome.addTransfer',
};

const OUTCOME_TONE: Record<RowOutcome['kind'], string> = {
  add: 'text-fg',
  newPlan: 'text-fg',
  payment: 'text-fg',
  merge: 'text-muted',
  link: 'text-muted',
  duplicate: 'text-muted',
  paymentRecorded: 'text-muted',
  skip: 'text-muted',
  dropped: 'text-muted',
  invalid: 'text-alert',
};

function outcomeText(
  outcome: RowOutcome,
  t: ReturnType<typeof useI18n>['t'],
  format: ReturnType<typeof useFormat>,
  card: Card,
  planName: (id: string) => string,
  paidCard?: CreditCard,
): string {
  switch (outcome.kind) {
    case 'add':
      if (outcome.manualMatch) return t('review.outcome.addUnmerged');
      return t(ADD_TEXT[outcome.flag ?? 'none']);
    case 'duplicate':
      return t('review.outcome.duplicate');
    case 'merge':
      return t(outcome.fillDescription ? 'review.outcome.mergeFill' : 'review.outcome.merge');
    case 'link':
      return t('review.outcome.link', { name: planName(outcome.planId) });
    case 'newPlan':
      return t('review.outcome.newPlan', {
        count: outcome.count,
        amount: format.money(outcome.totalAmount, card.currency),
      });
    case 'payment': {
      const params = {
        date: format.date(outcome.dueDate),
        amount: format.money(outcome.amountDue, paidCard?.currency ?? card.currency),
      };
      return paidCard
        ? t('review.outcome.paymentCard', { ...params, card: paidCard.name })
        : t('review.outcome.payment', params);
    }
    case 'paymentRecorded':
      return t(
        outcome.reason === 'autoPay' ? 'review.outcome.autoPay' : 'review.outcome.paymentRecorded',
      );
    case 'skip':
      return t(`review.outcome.skip.${outcome.reason}`);
    case 'dropped':
      return t('review.outcome.dropped');
    case 'invalid':
      return t(`review.outcome.invalid.${outcome.problem}`);
  }
}

function RowEditor({
  card,
  row,
  onChange,
}: {
  card: Card;
  row: DraftRow;
  onChange: (patch: Partial<DraftRow>) => void;
}) {
  const { t, locale } = useI18n();
  const [amount, setAmount] = useState(() =>
    row.amount === null ? '' : formatMoneyInput(row.amount, card.currency, locale),
  );
  const [installment, setInstallment] = useState(() =>
    row.installment ? `${row.installment.index}/${row.installment.count}` : '',
  );

  return (
    <div className="grid gap-3 pl-9 sm:grid-cols-2">
      <TextField
        label={t('tx.field.date')}
        type="date"
        value={row.date ?? ''}
        onChange={(value) => onChange({ date: isIsoDate(value) ? value : null })}
      />
      <TextField
        label={t('tx.field.amount')}
        inputMode="decimal"
        value={amount}
        onChange={(value) => {
          setAmount(value);
          onChange({ amount: parseMoneyInput(value, card.currency, locale) });
        }}
      />
      <div className="sm:col-span-2">
        <TextField
          label={t('tx.field.description')}
          value={row.description}
          maxLength={120}
          onChange={(description) => onChange({ description })}
        />
      </div>
      {row.type === 'installment' && (
        <TextField
          label={t('review.field.installment')}
          value={installment}
          onChange={(value) => {
            setInstallment(value);
            const marker = parseInstallmentColumn(value);
            onChange({ installment: marker ?? undefined });
          }}
        />
      )}
    </div>
  );
}
