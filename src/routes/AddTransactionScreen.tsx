import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { BalanceOverrideForm } from '../components/cards/BalanceOverrideForm';
import { CardTitle } from '../components/cards/CardTitle';
import { TransactionForm } from '../components/cards/TransactionForm';
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

  return (
    <section>
      <ScreenHeader title={t('tx.newTitle')} backTo={`/cards/${id}`} />
      {data === undefined ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : data === null ? (
        <p className="text-muted">{t('cards.notFound')}</p>
      ) : (
        <>
          <div className="mb-4">
            <CardTitle card={data.card} />
          </div>
          {/* Shown above the entry form so the typed entry is kept while the balance is updated. */}
          {updatingBalance && (
            <div className="mb-4">
              <BalanceOverrideForm
                card={data.card}
                onCancel={() => setUpdatingBalance(false)}
                onSubmit={async (balance, asOf) => {
                  await balanceOverridesRepo.add(data.card, balance, asOf);
                  setUpdatingBalance(false);
                }}
              />
            </div>
          )}
          <TransactionForm
            card={data.card}
            checkSpend={(request) => checkSpendAllowed(data.usageInput, request)}
            onUpdateBalance={() => setUpdatingBalance(true)}
            editLimitTo={`/cards/${id}/edit`}
            onCancel={() => navigate(-1)}
            onSubmit={async (entry) => {
              await transactionsRepo.addManual({ ...entry, card: data.card });
              navigate(`/cards/${id}`, { replace: true });
            }}
          />
        </>
      )}
    </section>
  );
}
