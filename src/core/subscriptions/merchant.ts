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

/** Words that say how something is billed, not who bills it: left out of display names. */
const GENERIC = new Set([
  'fatura',
  'faturasi',
  'abonelik',
  'aboneligi',
  'uyelik',
  'subscr',
  'subscription',
  'odeme',
  'odemesi',
  'payment',
  'otomatik',
  'talimat',
  'talimati',
  'bill',
]);

/** Common services, by merchant key, with the name people know them by. */
const BRANDS: Record<string, string> = {
  netflix: 'Netflix',
  spotify: 'Spotify',
  'google youtube': 'YouTube Premium',
  'google one': 'Google One',
  'apple bill': 'Apple',
  'amazon prime': 'Amazon Prime',
  openai: 'ChatGPT',
  disney: 'Disney+',
  exxen: 'Exxen',
  blutv: 'BluTV',
  gain: 'Gain',
  mubi: 'MUBI',
  tod: 'TOD',
  adobe: 'Adobe',
  macfit: 'MACFit',
  turkcell: 'Turkcell',
  vodafone: 'Vodafone',
  'turk telekom': 'Türk Telekom',
  superonline: 'Superonline',
  enerjisa: 'Enerjisa',
  igdas: 'İGDAŞ',
  iski: 'İSKİ',
};

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

/**
 * A readable name for a series (D19): a known brand ("Netflix", "YouTube Premium"), else
 * the description's own words without processors, noise and billing words, in title case
 * ("KAHVE DÜNYASI ABONELİK" → "Kahve Dünyası"). The bank's text stays in the details.
 */
export function displayName(description: string): string {
  const key = merchantKey(description);
  const brand = BRANDS[key];
  if (brand) return brand;
  const words = description.split(/[^\p{L}\p{N}]+/u).filter((word) => {
    const folded = normalizeDescription(word);
    return (
      folded.length > 1 &&
      !/\d/.test(folded) &&
      !NOISE.has(folded) &&
      !CITIES.has(folded) &&
      !GENERIC.has(folded)
    );
  });
  while (words.length > 1 && PROCESSORS.has(normalizeDescription(words[0]!))) words.shift();
  // All-caps ASCII ("DUNYASI") is not Turkish-cased, or it reads "Dunyası".
  const locale = /[çğıöşüÇĞİÖŞÜ]/.test(description) ? 'tr' : 'en';
  const name = words
    .slice(0, 3)
    .map(
      (word) => word.charAt(0).toLocaleUpperCase(locale) + word.slice(1).toLocaleLowerCase(locale),
    )
    .join(' ');
  return name || description.trim();
}
