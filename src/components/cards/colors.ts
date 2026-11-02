/** Card accent colors offered in the card form. */
export const CARD_COLORS = [
  '#34d399',
  '#38bdf8',
  '#a78bfa',
  '#f472b6',
  '#fbbf24',
  '#fb923c',
  '#94a3b8',
  '#2dd4bf',
] as const;

export const DEFAULT_CARD_COLOR = CARD_COLORS[0];

export const LEVEL_TEXT = {
  healthy: 'text-success',
  warning: 'text-warn',
  alert: 'text-alert',
} as const;
