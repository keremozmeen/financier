import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router';
import { CardForm } from '../components/cards/CardForm';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { cardsRepo, type CardInput } from '../db';
import { useT } from '../i18n';

export function NewCardScreen() {
  const t = useT();
  const navigate = useNavigate();

  async function create(input: CardInput) {
    const id = await cardsRepo.create(input);
    navigate(`/cards/${id}`, { replace: true });
  }

  return (
    <section>
      <ScreenHeader title={t('cards.newTitle')} backTo="/cards" />
      <CardForm onSubmit={create} onCancel={() => navigate(-1)} />
    </section>
  );
}

export function EditCardScreen() {
  const t = useT();
  const navigate = useNavigate();
  const id = useParams().id ?? '';
  const data = useLiveQuery(async () => {
    const card = await cardsRepo.get(id);
    if (!card) return null;
    const counts = await cardsRepo.countRecords(id);
    return { card, hasRecords: counts.transactions + counts.overrides > 0 };
  }, [id]);

  async function save(input: CardInput) {
    await cardsRepo.update(id, input);
    navigate(`/cards/${id}`, { replace: true });
  }

  return (
    <section>
      <ScreenHeader title={t('cards.editTitle')} backTo={`/cards/${id}`} />
      {data === undefined ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : data === null ? (
        <p className="text-muted">{t('cards.notFound')}</p>
      ) : (
        <CardForm
          initial={data.card}
          hasEntries={data.hasRecords}
          onSubmit={save}
          onCancel={() => navigate(-1)}
        />
      )}
    </section>
  );
}
