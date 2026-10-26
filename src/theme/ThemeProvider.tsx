import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { readPreference, writePreference } from '../platform/storage';
import { isTheme, ThemeContext, type Theme } from './context';

const STORAGE_KEY = 'financier.theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = readPreference(STORAGE_KEY);
    return isTheme(saved) ? saved : 'dark';
  });

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    writePreference(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
