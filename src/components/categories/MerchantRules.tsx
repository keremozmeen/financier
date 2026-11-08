import { Trash2 } from 'lucide-react';
import { parseCategory } from '../../core/categories';
import { merchantRulesRepo } from '../../db';
import { useMerchantRules } from '../../hooks/useCategories';
import { useT } from '../../i18n';
import { categoryKey } from './categoryDisplay';

/** The user's "always this category" rules (D22), in the detailed view of Settings. */
export function MerchantRules() {
  const t = useT();
  const rules = useMerchantRules();

  return (
    <section aria-labelledby="rules-title" className="panel p-4">
      <h2 id="rules-title" className="font-display text-lg font-bold tracking-tight">
        {t('settings.rules.title')}
      </h2>
      {rules?.length === 0 && (
        <p className="mt-1 text-sm text-muted">{t('settings.rules.empty')}</p>
      )}
      {rules && rules.length > 0 && (
        <ul className="mt-2 divide-y divide-border">
          {rules.map((rule) => {
            const category = parseCategory(rule.category);
            return (
              <li key={rule.id} className="flex items-center gap-3 py-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{rule.name}</p>
                  {category && (
                    <p className="text-xs text-muted">{t(categoryKey(category, true))}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void merchantRulesRepo.remove(rule.id)}
                  aria-label={t('settings.rules.remove', { name: rule.name })}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-raised hover:text-alert"
                >
                  <Trash2 aria-hidden="true" size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
