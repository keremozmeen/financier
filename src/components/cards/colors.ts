import { matchBank } from '../../core/banks';
import type { Card } from '../../types/domain';

/** Card colors offered in the card form: deep enough for white text on a card tile (D21). */
export const CARD_COLORS = [
  '#17694a',
  '#1f5fae',
  '#5b3fc4',
  '#a3305f',
  '#8a5a00',
  '#b0461a',
  '#4a5160',
  '#0f6b6b',
] as const;

export const DEFAULT_CARD_COLOR = CARD_COLORS[0];

/** The light colors cards were saved with before D21, shown as their deep match. */
const LEGACY_COLORS: Record<string, string> = {
  '#34d399': '#17694a',
  '#38bdf8': '#1f5fae',
  '#a78bfa': '#5b3fc4',
  '#f472b6': '#a3305f',
  '#fbbf24': '#8a5a00',
  '#fb923c': '#b0461a',
  '#94a3b8': '#4a5160',
  '#2dd4bf': '#0f6b6b',
};

/** The color a card is drawn in: always dark enough for white text (D21). */
export function cardColor(card: Pick<Card, 'color'>): string {
  return readableOnWhiteText(LEGACY_COLORS[card.color.toLowerCase()] ?? card.color);
}

/** WCAG contrast needed for white text on a card tile. */
const MIN_CONTRAST = 4.5;

/**
 * Darkens a #rrggbb color in small steps until white text on it reaches 4.5:1, so a
 * light color saved earlier or picked by hand still gives readable tiles.
 */
export function readableOnWhiteText(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  let rgb = [0, 2, 4].map((i) => parseInt(match[1]!.slice(i, i + 2), 16));
  for (let step = 0; step < 20 && contrastWithWhite(rgb) < MIN_CONTRAST; step++) {
    rgb = rgb.map((channel) => Math.round(channel * 0.9));
  }
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function contrastWithWhite(rgb: readonly number[]): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (luminance + 0.05);
}

/** A new card's color: its bank's, else the first one (D21). */
export function suggestedCardColor(bank: string, name: string): string {
  return matchBank(bank, name)?.color ?? DEFAULT_CARD_COLOR;
}

export const LEVEL_TEXT = {
  healthy: 'text-success',
  warning: 'text-warn',
  alert: 'text-alert',
} as const;
