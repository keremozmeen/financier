import type { CategoryRef } from '../../core/categories';
import { useDetailedView } from '../../hooks/useDetailedView';
import { useT } from '../../i18n';
import { CATEGORY_ICONS, categoryKey } from './categoryDisplay';

/** The quiet category label on an entry; tapping it opens the list (D22). */
export function CategoryChip({
  category,
  entry,
  onClick,
}: {
  category: CategoryRef;
  entry: string;
  onClick: () => void;
}) {
  const t = useT();
  const [detailed] = useDetailedView();
  const Icon = CATEGORY_ICONS[category.main];
  const name = t(categoryKey(category, detailed));
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('category.chip', { name, entry })}
      className="inline-flex min-h-7 items-center gap-1 rounded bg-surface-raised px-1.5 hover:text-fg"
    >
      <Icon aria-hidden="true" size={12} />
      {name}
    </button>
  );
}
