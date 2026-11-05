import { ChevronRight, PenLine, Upload } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCards } from '../hooks/useFinance';
import { useT } from '../i18n';
import { BankMark } from './cards/BankMark';
import { Dialog } from './ui/Dialog';

const ROW =
  'flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface-raised px-4 text-left font-semibold hover:bg-border';

/**
 * What the "+" opens (D21): import a statement, or add one entry to a card. With more
 * than one card, adding an entry asks which card first.
 */
export function AddSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const cards = useCards();
  const [picking, setPicking] = useState(false);

  function go(path: string) {
    onClose();
    navigate(path);
  }

  function addEntry() {
    if (!cards || cards.length === 0) return go('/cards/new');
    if (cards.length === 1) return go(`/cards/${cards[0]!.id}/add`);
    setPicking(true);
  }

  return (
    <Dialog title={picking ? t('add.pickCard') : t('nav.add')} onClose={onClose}>
      {picking ? (
        <ul className="grid gap-2">
          {cards?.map((card) => (
            <li key={card.id}>
              <button type="button" className={ROW} onClick={() => go(`/cards/${card.id}/add`)}>
                <BankMark card={card} size="sm" />
                <span className="min-w-0 flex-1 truncate">{card.name}</span>
                <ChevronRight aria-hidden="true" size={18} className="text-muted" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-2">
          <button type="button" className={ROW} onClick={() => go('/import')}>
            <Upload aria-hidden="true" size={20} />
            <span className="flex-1">
              <span className="block">{t('add.statement')}</span>
              <span className="block text-sm font-normal text-muted">
                {t('add.statement.hint')}
              </span>
            </span>
          </button>
          <button type="button" className={ROW} onClick={addEntry}>
            <PenLine aria-hidden="true" size={20} />
            <span className="flex-1">
              <span className="block">{t('add.entry')}</span>
              <span className="block text-sm font-normal text-muted">{t('add.entry.hint')}</span>
            </span>
          </button>
        </div>
      )}
    </Dialog>
  );
}
