import { useT } from '../../i18n';
import type { Card } from '../../types/domain';

/** Card name with its color dot and "Bank · •••• 1234" subtitle; debit cards say so (D13). */
export function CardTitle({
  card,
  as: Tag = 'h2',
  showName = true,
}: {
  card: Card;
  as?: 'h1' | 'h2' | 'h3';
  /** False where the screen heading already shows the name. */
  showName?: boolean;
}) {
  const t = useT();
  const subtitle = [
    card.bank,
    card.last4 && `•••• ${card.last4}`,
    card.type === 'debit' && t('cards.type.debit'),
  ]
    .filter(Boolean)
    .join(' · ');
  if (!showName && !subtitle) return null;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: card.color }}
      />
      <div className="min-w-0">
        {showName && <Tag className="truncate font-semibold">{card.name}</Tag>}
        {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}
