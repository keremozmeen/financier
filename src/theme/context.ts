import { createContext, useContext } from 'react';

/** What the user picked: follow the device, or a fixed theme (D21). */
export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export type ResolvedTheme = Exclude<Theme, 'system'>;

export function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}

export interface ThemeValue {
  theme: Theme;
  /** The theme on screen. */
  resolved: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeValue | null>(null);

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}
