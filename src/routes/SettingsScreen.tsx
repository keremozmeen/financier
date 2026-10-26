import { LOCALES, useI18n, type MessageKey } from '../i18n';
import { THEMES, useTheme } from '../theme/context';

interface SegmentedProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <fieldset className="rounded-xl border border-border bg-surface p-4">
      <legend className="px-1 text-sm font-medium text-muted">{label}</legend>
      <div className="mt-1 grid grid-flow-col gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={`min-h-11 rounded-lg px-3 text-sm font-medium transition-colors ${
              option.value === value
                ? 'bg-accent text-accent-fg'
                : 'bg-surface-raised text-fg hover:bg-border'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SettingsScreen() {
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('nav.settings')}</h1>
      <Segmented
        label={t('settings.language')}
        value={locale}
        onChange={setLocale}
        options={LOCALES.map((value) => ({ value, label: t(`locale.${value}` as MessageKey) }))}
      />
      <Segmented
        label={t('settings.theme')}
        value={theme}
        onChange={setTheme}
        options={THEMES.map((value) => ({ value, label: t(`settings.theme.${value}`) }))}
      />
      <p className="text-sm text-muted">{t('settings.privacy')}</p>
    </section>
  );
}
