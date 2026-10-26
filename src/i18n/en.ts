// English is the source dictionary: every key defined here must exist in tr.ts.
export const en = {
  'app.name': 'Financier',
  'app.tagline': 'Your private, offline finance buddy',

  'nav.label': 'Main navigation',
  'nav.dashboard': 'Dashboard',
  'nav.cards': 'Cards',
  'nav.import': 'Import',
  'nav.subRadar': 'Sub-Radar',
  'nav.subRadar.short': 'Sub-Radar',
  'nav.settings': 'Settings',

  'placeholder.comingSoon': 'Kipp is still setting this screen up.',

  'settings.language': 'Language',
  'settings.theme': 'Theme',
  'settings.theme.dark': 'Dark',
  'settings.theme.light': 'Light',
  'settings.privacy': 'Everything stays on this device. Nothing is sent anywhere.',

  'locale.en': 'English',
  'locale.tr': 'Türkçe',

  'pwa.updateAvailable': 'A new version of Financier is available.',
  'pwa.reload': 'Reload',
  'pwa.dismiss': 'Later',
  'pwa.offlineReady': 'Financier is ready to work offline.',
} as const;

export type MessageKey = keyof typeof en;
