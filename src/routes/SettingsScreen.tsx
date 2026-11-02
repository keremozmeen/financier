import { Segmented } from '../components/ui/Segmented';
import { LOCALES, useI18n, type MessageKey } from '../i18n';
import { THEMES, useTheme } from '../theme/context';

export function SettingsScreen() {
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('nav.settings')}</h1>
      <Segmented
        framed
        label={t('settings.language')}
        value={locale}
        onChange={setLocale}
        options={LOCALES.map((value) => ({ value, label: t(`locale.${value}` as MessageKey) }))}
      />
      <Segmented
        framed
        label={t('settings.theme')}
        value={theme}
        onChange={setTheme}
        options={THEMES.map((value) => ({ value, label: t(`settings.theme.${value}`) }))}
      />
      <p className="text-sm text-muted">{t('settings.privacy')}</p>
    </section>
  );
}
