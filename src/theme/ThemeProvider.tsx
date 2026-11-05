import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { readPreference, writePreference } from '../platform/storage';
import { isTheme, ThemeContext, type ResolvedTheme, type Theme } from './context';

const STORAGE_KEY = 'financier.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
/** The browser bar matches the page ground (D21). */
const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#eef0f3', dark: '#121412' };

function deviceTheme(): ResolvedTheme {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
    ? 'dark'
    : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = readPreference(STORAGE_KEY);
    return isTheme(saved) ? saved : 'system';
  });
  const [device, setDevice] = useState<ResolvedTheme>(deviceTheme);
  const resolved = theme === 'system' ? device : theme;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DARK_QUERY);
    const update = () => setDevice(query.matches ? 'dark' : 'light');
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLOR[resolved]);
    if (root.dataset.theme === resolved) return;
    // Suspend transitions so every color flips at once instead of fading.
    root.classList.add('theme-switching');
    root.dataset.theme = resolved;
    void root.offsetHeight; // Flush styles while transitions are off.
    const frame = requestAnimationFrame(() => root.classList.remove('theme-switching'));
    return () => {
      cancelAnimationFrame(frame);
      root.classList.remove('theme-switching');
    };
  }, [resolved]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    writePreference(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
