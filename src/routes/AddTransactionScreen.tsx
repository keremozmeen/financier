import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { BalanceOverrideForm } from '../components/cards/BalanceOverrideForm';
import { CardTitle } from '../components/cards/CardTitle';
import { TransactionForm, type SpendGuard } from '../components/cards/TransactionForm';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { checkSpendAllowed } from '../core/finance';
import { balanceOverridesRepo, transactionsRepo } from '../db';
import { useCardForEntry } from '../hooks/useFinance';
import { useT } from '../i18n';

export function AddTransactionScreen() {
  const t = useT();
  const navigate = useNavigate();
  const id = useParams().id ?? '';
  const data = useCardForEntry(id);
  const [updatingBalance, setUpdatingBalance] = useState(false);

  if (data === undefined || data === null) {
    return (
      <section>
        <ScreenHeader title={t('tx.newTitle')} backTo={`/cards/${id}`} />
        <p className="text-muted">
          {data === undefined ? t('common.loading') : t('cards.notFound')}
        </p>
      </section>
    );
  }

  const { card, usageInput } = data;
  // D12 applies to credit cards only; debit spending is never blocked (D13).
  const credit = card.type === 'credit' && usageInput ? card : undefined;
  const spendGuard: SpendGuard | undefined =
    credit && usageInput
      ? {
          check: (request) => checkSpendAllowed(usageInput, request),
          onUpdateBalance: () => setUpdatingBalance(true),
          editLimitTo: `/cards/${id}/edit`,
        }
      : undefined;

  return (
    <section>
      <ScreenHeader title={t('tx.newTitle')} backTo={`/cards/${id}`} />
      <div className="mb-4">
        <CardTitle card={card} />
      </div>
      {/* Shown above the entry form so the typed entry is kept while the balance is updated. */}
      {credit && updatingBalance && (
        <div className="mb-4">
          <BalanceOverrideForm
            card={credit}
            onCancel={() => setUpdatingBalance(false)}
            onSubmit={async (balance, asOf) => {
              await balanceOverridesRepo.add(credit, balance, asOf);
              setUpdatingBalance(false);
            }}
          />
        </div>
      )}
      <TransactionForm
        card={card}
        spendGuard={spendGuard}
        onCancel={() => navigate(-1)}
        onSubmit={async (entry) => {
          await transactionsRepo.addManual({ ...entry, card });
          navigate(`/cards/${id}`, { replace: true });
        }}
      />
    </section>
  );
}
