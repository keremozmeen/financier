import { normalizeDescription } from '../finance';

// D19 merchant key: the words that name who is billing, without processor prefixes,
// web and company noise, city names or reference numbers.

/** Payment processors that put their name in front of the merchant's. */
const PROCESSORS = new Set([
  'iyzico',
  'iyz',
  'paytr',
  'payu',
  'param',
  'parampos',
  'craftgate',
  'sipay',
  'moka',
  'pos',
  'sanal',
]);

/** Web, company and country noise. */
const NOISE = new Set([
  'www',
  'http',
  'https',
  'com',
  'net',
  'org',
  'tr',
  'co',
  'inc',
  'ltd',
  'sti',
  'as',
  'llc',
  'gmbh',
  'bv',
  'sa',
  'tic',
  'san',
  've',
  'turkiye',
  'turkey',
  'tl',
  'try',
]);

const CITIES = new Set([
  'istanbul',
  'ankara',
  'izmir',
  'bursa',
  'antalya',
  'adana',
  'konya',
  'kocaeli',
  'kadikoy',
  'besiktas',
  'sisli',
  'dublin',
  'luxembourg',
  'stockholm',
  'amsterdam',
  'london',
  'cork',
]);

/** Platforms that bill several services under one name: the key keeps the next word too. */
const PLATFORMS = new Set(['google', 'apple', 'amazon', 'microsoft', 'paypal', 'turk', 'the']);

/**
 * The D19 merchant key of a description: "NETFLIX.COM", "NETFLIX COM ISTANBUL" and
 * "IYZICO *NETFLIX" are all `netflix`; "GOOGLE *YOUTUBE PREMIUM" is `google youtube`.
 * Empty when nothing names a merchant.
 */
export function merchantKey(description: string): string {
  const words = normalizeDescription(description)
    .split(' ')
    .filter((word) => word.length > 1 && !/\d/.test(word) && !NOISE.has(word) && !CITIES.has(word));
  while (words.length > 1 && PROCESSORS.has(words[0]!)) words.shift();
  // "GOOGLE *GOOGLE ONE": a repeated platform name is one word.
  const unique = words.filter((word, i) => word !== words[i - 1]);
  const [first, second] = unique;
  if (!first) return '';
  return PLATFORMS.has(first) && second ? `${first} ${second}` : first;
}
