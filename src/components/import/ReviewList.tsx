import { Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatMoneyInput, isIsoDate, parseMoneyInput } from '../../core/finance';
import {
  countOutcomes,
  editDraft,
  planImport,
  reviewAmount,
  type DraftRow,
  type ImportContext,
  type PlannedRow,
  type RowOutcome,
} from '../../core/import';
import { parseInstallmentColumn, rowTypesFor, type ImportRowType } from '../../parsers/common';
import { useDetailedView } from '../../hooks/useDetailedView';
import { useFormat } from '../../hooks/useFormat';
import { useI18n, type MessageKey } from '../../i18n';
import type { Card, CreditCard, StatementKind } from '../../types/domain';
import { Button } from '../ui/Button';
import { EntryAmount } from '../ui/EntryAmount';
import { inputClass, TextField } from '../ui/TextField';

/**
 * Step 3 of an import (D3, D16, D20): how many rows are ready and how many need a look,
 * opening on the latter. The detailed view lists every row with its controls.
 */
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
  const [detailed] = useDetailedView();
  const [showAll, setShowAll] = useState(false);
  const planned = useMemo(() => planImport(drafts, context), [drafts, context]);
  const toCheck = planned.filter(needsLook);
  const ready = planned.filter((item) => !needsLook(item) && WILL_SAVE.has(item.outcome.kind));
  // The simple view opens on the rows needing a look; the rest are a tap away (D20).
  const visible = detailed || showAll ? planned : toCheck;
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
      <h2 id="review-title" className="sr-only">
        {t('review.title')}
      </h2>
      {drafts.length > 0 && (
        <div className="panel p-5">
          <p className="font-display text-[1.75rem] leading-tight font-bold tracking-tight">
            {t('review.ready', { count: ready.length })}
          </p>
          <p className={`mt-1 ${toCheck.length > 0 ? 'font-medium text-warn' : 'text-muted'}`}>
            {toCheck.length > 0
              ? t('review.needLook', { count: toCheck.length })
              : t('review.allReady')}
          </p>
        </div>
      )}
      {detailed && <p className="text-sm text-muted">{t('review.help')}</p>}
      <ul
        aria-label={t('review.title')}
        className={`flex flex-wrap gap-2 text-sm ${detailed ? '' : 'sr-only'}`}
      >
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
        <p className="panel p-4 text-muted">{t('review.empty')}</p>
      ) : (
        visible.length > 0 && (
          <ul className="divide-y divide-border panel">
            {visible.map((item) => {
              const index = planned.indexOf(item);
              return (
                <ReviewRow
                  key={item.row.line}
                  card={card}
                  statement={statement}
                  creditCards={creditCards}
                  item={item}
                  detailed={detailed}
                  planName={(id) => planNames.get(id) || t('tx.fallback.installment')}
                  onChange={(patch) => update(index, patch)}
                />
              );
            })}
          </ul>
        )
      )}
      {!detailed && drafts.length > 0 && toCheck.length < planned.length && (
        <Button variant="ghost" className="-ml-3" onClick={() => setShowAll((all) => !all)}>
          {showAll ? t('review.showLook') : t('review.showAll', { count: planned.length })}
        </Button>
      )}
      <Button
        variant="primary"
        className="w-full"
        onClick={onImport}
        disabled={busy || drafts.length === 0}
      >
        {t('review.import')}
      </Button>
    </section>
  );
}

function ReviewRow({
  card,
  statement,
  creditCards,
  item,
  detailed,
  planName,
  onChange,
}: {
  card: Card;
  statement: StatementKind;
  creditCards: readonly CreditCard[];
  item: PlannedRow;
  /** The detailed view shows every row's controls; the simple view opens them on tap. */
  detailed: boolean;
  planName: (id: string) => string;
  onChange: (patch: Partial<DraftRow>) => void;
}) {
  const { t } = useI18n();
  const format = useFormat();
  const { row, outcome } = item;
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(detailed || needsLook(item));
  const types = rowTypesFor(card.type, statement);
  const moneyIn = row.type === 'refund' || row.type === 'income';
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
            {detailed && <span>{t('review.row', { line: row.line })}</span>}
            {row.confidence !== 'high' && (
              <span className="rounded bg-warn/15 px-1.5 py-0.5 text-warn">
                {t(row.confidence === 'low' ? 'review.confidence.low' : 'review.confidence.medium')}
              </span>
            )}
          </p>
        </div>
        {row.amount === null ? (
          <span className="shrink-0 font-semibold">{t('mapping.unreadable')}</span>
        ) : (
          <EntryAmount
            amount={reviewAmount(row)}
            currency={card.currency}
            label={moneyIn ? t(`review.type.${row.type}`) : undefined}
          />
        )}
      </div>
      {!open && (
        <div className="flex items-center gap-2 pl-9">
          <p className={`min-w-0 flex-1 text-sm ${OUTCOME_TONE[outcome.kind]}`}>
            {outcomeText(outcome, t, format, card, planName, paidCard)}
          </p>
          <Button
            variant="ghost"
            className="shrink-0"
            aria-label={t('review.changeRow', { line: row.line })}
            onClick={() => setOpen(true)}
          >
            {t('review.change')}
          </Button>
        </div>
      )}
      {open && (
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
      )}
      {open && (
        <p className={`pl-9 text-sm ${OUTCOME_TONE[outcome.kind]}`}>
          {outcomeText(outcome, t, format, card, planName, paidCard)}
        </p>
      )}
      {open && editing && <RowEditor card={card} row={row} onChange={onChange} />}
    </li>
  );
}

/** Outcomes that save something when the user taps Import. */
const WILL_SAVE = new Set<RowOutcome['kind']>(['add', 'merge', 'link', 'newPlan', 'payment']);

/**
 * A row the user should look at before importing (D20): one that can't be saved as it
 * is, one whose type or values were guessed, or a payment whose card must be picked.
 */
function needsLook({ row, outcome }: PlannedRow): boolean {
  if (row.dropped) return false;
  return (
    outcome.kind === 'invalid' ||
    row.confidence !== 'high' ||
    (outcome.kind === 'skip' && outcome.reason === 'pickCard')
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
