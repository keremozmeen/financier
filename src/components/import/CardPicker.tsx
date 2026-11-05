import { useT } from '../../i18n';
import type { Card } from '../../types/domain';
import { BankMark } from '../cards/BankMark';

/** "Which card?": the cards as chips with their bank marks, one chosen (D21). */
export function CardPicker({
  cards,
  value,
  onChange,
}: {
  cards: readonly Card[];
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useT();
  return (
    <fieldset>
      <legend className="mb-2.5 text-sm font-semibold text-muted">{t('add.pickCard')}</legend>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {cards.map((card) => {
          const checked = card.id === value;
          return (
            <label
              key={card.id}
              className={`flex h-13 shrink-0 cursor-pointer items-center gap-2.5 rounded-full border-2 bg-surface py-1 pr-4 pl-1.5 has-focus-visible:ring-2 has-focus-visible:ring-accent ${
                checked ? 'border-fg font-semibold' : 'border-transparent'
              }`}
            >
              <input
                type="radio"
                name="import-card"
                value={card.id}
                checked={checked}
                onChange={() => onChange(card.id)}
                className="sr-only"
              />
              <BankMark card={card} size="sm" />
              <span className="whitespace-nowrap">{card.name}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
