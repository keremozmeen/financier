import { CreditCard, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { CardTitle } from '../components/cards/CardTitle';
import { LimitGauge } from '../components/cards/LimitGauge';
import { UsageFigures } from '../components/cards/UsageFigures';
import { ButtonLink } from '../components/ui/Button';
import { useCardsWithUsage } from '../hooks/useFinance';
import { useT } from '../i18n';

export function DashboardScreen() {
  const t = useT();
  const cards = useCardsWithUsage();

  return (
    <section>
      <h1 className="text-2xl font-semibold">{t('nav.dashboard')}</h1>
      {cards === undefined ? (
        <p className="mt-4 text-muted">{t('common.loading')}</p>
      ) : cards.length === 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-surface p-6 text-center">
          <CreditCard aria-hidden="true" className="mx-auto text-muted" size={32} />
          <h2 className="mt-3 font-semibold">{t('dashboard.empty.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('dashboard.empty.body')}</p>
          <ButtonLink to="/cards/new" variant="primary" className="mt-4">
            <Plus aria-hidden="true" size={18} />
            {t('cards.add')}
          </ButtonLink>
        </div>
      ) : (
        <>
          <h2 className="mt-4 mb-2 text-sm font-medium text-muted">{t('dashboard.gaugesTitle')}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {cards.map(({ card, usage }) => (
              <li key={card.id}>
                <Link
                  to={`/cards/${card.id}`}
                  className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-muted"
                >
                  <CardTitle card={card} as="h3" />
                  <div className="mt-3 flex items-center gap-4">
                    <LimitGauge usage={usage} name={card.name} size={112} />
                    <UsageFigures card={card} usage={usage} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
