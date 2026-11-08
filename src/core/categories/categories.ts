// The D22 category list. Ids are stable English slugs and may be stored, so never rename
// one; names and icons live in the UI layer.

export const CATEGORIES = {
  groceries: ['supermarket', 'fresh', 'online'],
  'eating-out': ['restaurant', 'fast-food', 'cafe', 'delivery'],
  transport: ['fuel', 'public-transport', 'taxi', 'parking'],
  bills: ['electricity', 'gas', 'water', 'internet', 'phone'],
  subscriptions: ['video', 'music', 'apps', 'fitness'],
  shopping: ['clothing', 'electronics', 'home', 'online'],
  health: ['pharmacy', 'hospital', 'optical'],
  entertainment: ['cinema', 'events', 'games'],
  travel: ['flights', 'hotels', 'intercity', 'car-rental'],
  education: ['school', 'courses', 'books'],
  cash: ['atm', 'advance'],
  fees: ['interest', 'bank'],
  other: [],
} as const satisfies Record<string, readonly string[]>;

export type MainCategoryId = keyof typeof CATEGORIES;

export const MAIN_CATEGORY_IDS = Object.keys(CATEGORIES) as MainCategoryId[];

/** What `transactions.category` holds when the user has not picked a category. */
export const NO_PICK = 'uncategorized';

export interface CategoryRef {
  main: MainCategoryId;
  sub?: string;
}

/** The stored form of a category: `transport` or `transport/fuel`. */
export function categoryPath({ main, sub }: CategoryRef): string {
  return sub ? `${main}/${sub}` : main;
}

/** Reads a stored category. Null for `uncategorized` and anything not in the list. */
export function parseCategory(value: string | undefined): CategoryRef | null {
  if (!value) return null;
  const [main, sub, extra] = value.split('/');
  if (extra !== undefined || !main || !Object.hasOwn(CATEGORIES, main)) return null;
  const id = main as MainCategoryId;
  if (sub === undefined) return { main: id };
  return (CATEGORIES[id] as readonly string[]).includes(sub) ? { main: id, sub } : null;
}
