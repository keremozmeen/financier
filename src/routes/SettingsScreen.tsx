import { MerchantRules } from '../components/categories/MerchantRules';
import { Checkbox } from '../components/ui/Checkbox';
import { Segmented } from '../components/ui/Segmented';
import { useDetailedView } from '../hooks/useDetailedView';
import { LOCALES, useI18n, type MessageKey } from '../i18n';
import { THEMES, useTheme } from '../theme/context';

export function SettingsScreen() {
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [detailed, setDetailed] = useDetailedView();

  return (
    <section className="space-y-4">
      <h1 className="font-display text-[1.625rem] font-bold tracking-tight">{t('nav.settings')}</h1>
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
      <div className="panel px-4 py-2">
        <Checkbox
          label={t('settings.detailed')}
          hint={t('settings.detailed.hint')}
          checked={detailed}
          onChange={setDetailed}
        />
      </div>
      {detailed && <MerchantRules />}
      <p className="text-sm text-muted">{t('settings.privacy')}</p>
    </section>
  );
}
