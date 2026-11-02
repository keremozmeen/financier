import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router';
import { CardTitle } from '../components/cards/CardTitle';
import { TransactionForm } from '../components/cards/TransactionForm';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { cardsRepo, transactionsRepo } from '../db';
import { useT } from '../i18n';

export function AddTransactionScreen() {
  const t = useT();
  const navigate = useNavigate();
  const id = useParams().id ?? '';
  const card = useLiveQuery(async () => (await cardsRepo.get(id)) ?? null, [id]);

  return (
    <section>
      <ScreenHeader title={t('tx.newTitle')} backTo={`/cards/${id}`} />
      {card === undefined ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : card === null ? (
        <p className="text-muted">{t('cards.notFound')}</p>
      ) : (
        <>
          <div className="mb-4">
            <CardTitle card={card} />
          </div>
          <TransactionForm
            card={card}
            onCancel={() => navigate(-1)}
            onSubmit={async (entry) => {
              await transactionsRepo.addManual({ ...entry, card });
              navigate(`/cards/${id}`, { replace: true });
            }}
          />
        </>
      )}
    </section>
  );
}
