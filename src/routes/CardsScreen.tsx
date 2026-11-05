import { ChevronRight, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { CardTitle } from '../components/cards/CardTitle';
import { LEVEL_TEXT } from '../components/cards/colors';
import { ButtonLink } from '../components/ui/Button';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useCards, useCardSummaries } from '../hooks/useFinance';
import { useFormat } from '../hooks/useFormat';
import { useT } from '../i18n';

export function CardsScreen() {
  const t = useT();
  const format = useFormat();
  const active = useCardSummaries();
  const archived = useCards({ includeArchived: true })?.filter((card) => card.archived);

  return (
    <section>
      <ScreenHeader
        title={t('nav.cards')}
        actions={
          <ButtonLink to="/cards/new" variant="primary">
            <Plus aria-hidden="true" size={18} />
            {t('cards.add')}
          </ButtonLink>
        }
      />
      {active === undefined ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : active.length === 0 ? (
        <p className="panel p-4 text-muted">{t('cards.empty')}</p>
      ) : (
        <ul className="divide-y divide-border panel">
          {active.map((summary) => (
            <li key={summary.card.id}>
              <Link
                to={`/cards/${summary.card.id}`}
                className="flex min-h-16 items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <CardTitle card={summary.card} />
                </div>
                {'usage' in summary ? (
                  <div className="text-right text-sm">
                    <p className={`font-semibold tabular-nums ${LEVEL_TEXT[summary.usage.level]}`}>
                      {format.money(summary.usage.used, summary.card.currency)}
                    </p>
                    <p className="text-xs text-muted tabular-nums">
                      / {format.money(summary.card.limit, summary.card.currency)}
                    </p>
                  </div>
                ) : (
                  <div className="text-right text-sm">
                    <p className="font-semibold tabular-nums">
                      {format.money(summary.monthSpending, summary.card.currency)}
                    </p>
                    <p className="text-xs text-muted">{t('debit.thisMonth')}</p>
                  </div>
                )}
                <ChevronRight aria-hidden="true" size={18} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {archived && archived.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 text-sm font-medium text-muted">{t('cards.archivedTitle')}</h2>
          <ul className="divide-y divide-border panel opacity-80">
            {archived.map((card) => (
              <li key={card.id}>
                <Link
                  to={`/cards/${card.id}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <CardTitle card={card} />
                  </div>
                  <ChevronRight aria-hidden="true" size={18} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
