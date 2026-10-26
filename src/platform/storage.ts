/**
 * Small UI preferences (theme, locale) that must be readable before the first
 * render. Financial data never goes here; it lives in IndexedDB via src/db/.
 * Storage can be unavailable (private mode, blocked site data), so every
 * access is guarded and failures fall back to defaults.
 */
export function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore: the preference simply won't survive a reload.
  }
}
