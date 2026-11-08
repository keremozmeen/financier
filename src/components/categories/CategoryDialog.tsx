import { useState } from 'react';
import {
  CATEGORIES,
  MAIN_CATEGORY_IDS,
  categoryPath,
  type CategoryRef,
} from '../../core/categories';
import { categoryMerchantKey, merchantLabel } from '../../core/merchant';
import { merchantRulesRepo, transactionsRepo } from '../../db';
import { useDetailedView } from '../../hooks/useDetailedView';
import { useT } from '../../i18n';
import type { Transaction } from '../../types/domain';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { CATEGORY_ICONS, categoryKey } from './categoryDisplay';

/**
 * Picks an entry's category, then asks once whether the merchant is always that category
 * (D22). One dialog with two stages, so "back" leaves it in one step.
 */
export function CategoryDialog({
  entry,
  rules,
  onClose,
}: {
  entry: Pick<Transaction, 'id' | 'description'>;
  rules: ReadonlyMap<string, string>;
  onClose: () => void;
}) {
  const t = useT();
  const [detailed] = useDetailedView();
  const [picked, setPicked] = useState<string | null>(null);
  const merchant = categoryMerchantKey(entry.description);

  const choose = async (category: CategoryRef) => {
    const path = categoryPath(category);
    await transactionsRepo.setCategory(entry.id, path);
    // No merchant to apply to, or the rule already says this.
    if (!merchant || rules.get(merchant) === path) onClose();
    else setPicked(path);
  };

  if (picked) {
    return (
      <Dialog title={t('category.pick')} onClose={onClose}>
        <p className="font-medium">
          {t('category.applyAll', { merchant: merchantLabel(entry.description) })}
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button onClick={onClose}>{t('category.applyAll.no')}</Button>
          <Button
            variant="primary"
            onClick={() => void merchantRulesRepo.set(merchant, picked).then(onClose)}
          >
            {t('category.applyAll.yes')}
          </Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title={t('category.pick')} onClose={onClose}>
      <ul className="divide-y divide-border">
        {MAIN_CATEGORY_IDS.map((main) => {
          const Icon = CATEGORY_ICONS[main];
          return (
            <li key={main}>
              <button
                type="button"
                onClick={() => void choose({ main })}
                className="flex min-h-11 w-full items-center gap-3 text-left font-medium hover:bg-surface-raised"
              >
                <Icon aria-hidden="true" size={18} className="text-muted" />
                {t(categoryKey({ main }, false))}
              </button>
              {detailed && CATEGORIES[main].length > 0 && (
                <div className="flex flex-wrap gap-2 pb-2 pl-7">
                  {CATEGORIES[main].map((sub: string) => (
                    <Button key={sub} className="px-3" onClick={() => void choose({ main, sub })}>
                      {t(categoryKey({ main, sub }, true))}
                    </Button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
