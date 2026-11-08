import {
  Banknote,
  Car,
  CircleEllipsis,
  Clapperboard,
  GraduationCap,
  HeartPulse,
  Percent,
  Plane,
  Receipt,
  Repeat,
  ShoppingBag,
  ShoppingBasket,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryRef, MainCategoryId } from '../../core/categories';
import type { MessageKey } from '../../i18n';

export const CATEGORY_ICONS: Record<MainCategoryId, LucideIcon> = {
  groceries: ShoppingBasket,
  'eating-out': UtensilsCrossed,
  transport: Car,
  bills: Receipt,
  subscriptions: Repeat,
  shopping: ShoppingBag,
  health: HeartPulse,
  entertainment: Clapperboard,
  travel: Plane,
  education: GraduationCap,
  cash: Banknote,
  fees: Percent,
  other: CircleEllipsis,
};

/** The i18n key for a category; the simple view names main categories only (D22). */
export function categoryKey({ main, sub }: CategoryRef, detailed: boolean): MessageKey {
  return (detailed && sub ? `category.${main}.${sub}` : `category.${main}`) as MessageKey;
}
