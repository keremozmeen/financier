import {
  Archive,
  ArchiveRestore,
  Info,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { BalanceOverrideForm } from '../components/cards/BalanceOverrideForm';
import { CardTitle } from '../components/cards/CardTitle';
import { CardUsagePanel } from '../components/cards/CardUsagePanel';
import { DeleteCardDialog } from '../components/cards/DeleteCardDialog';
import { NextBill } from '../components/cards/NextBill';
import { PaymentForm } from '../components/cards/PaymentForm';
import { PaymentList } from '../components/cards/PaymentList';
import { TransactionList } from '../components/cards/TransactionList';
import { Button, ButtonLink } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import type { CardUsage } from '../core/finance';
import { balanceOverridesRepo, cardsRepo, paymentsRepo, transactionsRepo } from '../db';
import { useEntryLabel } from '../hooks/useEntryLabel';
import { useCardDetail } from '../hooks/useFinance';
import { useFormat } from '../hooks/useFormat';
import { useT } from '../i18n';
import type { Payment, Transaction } from '../types/domain';

export function CardDetailScreen() {
  const t = useT();
  const navigate = useNavigate();
  const id = useParams().id ?? '';
  const detail = useCardDetail(id);
  const entryLabel = useEntryLabel();
  const [editingBalance, setEditingBalance] = useState(false);
  const [paying, setPaying] = useState(false);
  const [deleteCounts, setDeleteCounts] = useState<{ transactions: number; overrides: number }>();
  const [pendingDelete, setPendingDelete] = useState<Transaction>();
  const [pendingPaymentDelete, setPendingPaymentDelete] = useState<Payment>();
  const format = useFormat();

  if (detail === undefined) return <p className="text-muted">{t('common.loading')}</p>;
  if (detail === null) {
    return (
      <section>
        <ScreenHeader title={t('nav.cards')} backTo="/cards" />
        <p className="text-muted">{t('cards.notFound')}</p>
      </section>
    );
  }

  const { summary, transactions, plans, payments } = detail;
  const { card } = summary;

  async function archive(archived: boolean) {
    await cardsRepo.setArchived(card.id, archived);
    setDeleteCounts(undefined);
    if (archived) navigate('/cards');
  }

  return (
    <section className="space-y-5">
      <ScreenHeader
        title={card.name}
        backTo="/cards"
        actions={
          <ButtonLink to={`/cards/${card.id}/edit`} variant="ghost" aria-label={t('common.edit')}>
            <Pencil aria-hidden="true" size={18} />
          </ButtonLink>
        }
      />

      {card.archived && (
        <p className="flex gap-2 rounded-xl border border-border bg-surface-raised p-3 text-sm">
          <Archive aria-hidden="true" size={18} className="shrink-0 text-muted" />
          {t('cards.archivedNotice')}
        </p>
      )}

      <div className="rounded-xl border border-border bg-surface p-4">
        <CardTitle card={card} showName={false} />
        <div className="mt-3">
          <CardUsagePanel summary={summary} gaugeSize={128} />
        </div>
        {'usage' in summary ? (
          <UsageSource usage={summary.usage} />
        ) : (
          <p className="mt-3 text-xs text-muted">{t('debit.note')}</p>
        )}
      </div>

      {/* Debit cards have no statements or payments (D13, D14). */}
      {'bill' in summary &&
        (paying ? (
          <PaymentForm
            card={summary.card}
            bill={summary.bill}
            onCancel={() => setPaying(false)}
            onSubmit={async (amount, date) => {
              await paymentsRepo.record(summary.card, summary.bill, amount, date);
              setPaying(false);
            }}
          />
        ) : (
          <NextBill card={summary.card} bill={summary.bill} onMarkPaid={() => setPaying(true)} />
        ))}

      {'usage' in summary && editingBalance ? (
        <BalanceOverrideForm
          card={summary.card}
          onCancel={() => setEditingBalance(false)}
          onSubmit={async (balance, asOf) => {
            await balanceOverridesRepo.add(summary.card, balance, asOf);
            setEditingBalance(false);
          }}
        />
      ) : (
        <div className={`grid gap-2 ${card.type === 'credit' ? 'grid-cols-2' : ''}`}>
          {/* Debit cards have no bank balance override (D13). */}
          {card.type === 'credit' && (
            <Button onClick={() => setEditingBalance(true)}>
              <RefreshCw aria-hidden="true" size={18} />
              {t('balance.update')}
            </Button>
          )}
          <ButtonLink to={`/cards/${card.id}/add`} variant="primary">
            <Plus aria-hidden="true" size={18} />
            {t('tx.add')}
          </ButtonLink>
        </div>
      )}

      <PaymentList payments={payments} onDelete={setPendingPaymentDelete} />

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted">{t('tx.title')}</h2>
        <TransactionList transactions={transactions} plans={plans} onDelete={setPendingDelete} />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="ghost" onClick={() => void archive(!card.archived)}>
          {card.archived ? (
            <ArchiveRestore aria-hidden="true" size={18} />
          ) : (
            <Archive aria-hidden="true" size={18} />
          )}
          {card.archived ? t('cards.unarchive') : t('cards.archive')}
        </Button>
        <Button
          variant="ghost"
          className="text-alert"
          onClick={async () => setDeleteCounts(await cardsRepo.countRecords(card.id))}
        >
          <Trash2 aria-hidden="true" size={18} />
          {t('common.delete')}
        </Button>
      </div>

      {deleteCounts && (
        <DeleteCardDialog
          card={card}
          counts={deleteCounts}
          onClose={() => setDeleteCounts(undefined)}
          onArchive={() => void archive(true)}
          onDelete={async () => {
            await cardsRepo.deletePermanently(card.id);
            navigate('/cards', { replace: true });
          }}
        />
      )}

      {pendingPaymentDelete && (
        <Dialog
          title={t('payments.delete.title')}
          onClose={() => setPendingPaymentDelete(undefined)}
        >
          <p className="text-sm">
            {t('payments.delete.body', {
              amount: format.money(pendingPaymentDelete.amount, pendingPaymentDelete.currency),
              date: format.date(pendingPaymentDelete.date),
            })}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingPaymentDelete(undefined)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await paymentsRepo.remove(pendingPaymentDelete.id);
                setPendingPaymentDelete(undefined);
              }}
            >
              {t('common.delete')}
            </Button>
          </div>
        </Dialog>
      )}

      {pendingDelete && (
        <Dialog title={t('tx.delete.title')} onClose={() => setPendingDelete(undefined)}>
          <p className="text-sm">
            {t(pendingDelete.installmentPlanId ? 'tx.delete.bodyPlan' : 'tx.delete.body', {
              description: entryLabel(pendingDelete),
            })}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingDelete(undefined)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await transactionsRepo.remove(pendingDelete.id);
                setPendingDelete(undefined);
              }}
            >
              {t('common.delete')}
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

/** Whether "used" is calculated or comes from the bank balance override (D11). */
function UsageSource({ usage }: { usage: CardUsage }) {
  const t = useT();
  const format = useFormat();
  const { source } = usage;

  return (
    <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
      <p className="font-medium">
        {source.kind === 'override'
          ? t('cards.source.override', { date: format.date(source.asOf) })
          : t('cards.source.calculated')}
      </p>
      {source.kind === 'override' && source.stale && (
        <p className="flex gap-2 text-warn">
          <TriangleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          {t('cards.source.stale')}
        </p>
      )}
      {source.kind === 'calculated' && usage.used > 0 && (
        <p className="flex gap-2 text-muted">
          <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          {t('cards.source.calculated.hint')}
        </p>
      )}
    </div>
  );
}
