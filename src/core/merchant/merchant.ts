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

// ---- Cleaned words for categories (D22) ----
// These stay apart from merchantKey on purpose: Sub-Radar's stored choices are keyed by
// merchantKey, so its result must not change. Categories also need names with digits
// ("A101", "N11") and drop more noise, because a wrong word here means a wrong category.

const CATEGORY_PROCESSORS = new Set([
  ...PROCESSORS,
  'iyzipay',
  'iyzi',
  'paycell',
  'tosla',
  'hepsipay',
  'papara',
  'ininal',
  'stripe',
  'shopier',
]);

const CATEGORY_NOISE = new Set([
  ...NOISE,
  'taksit',
  'taksiti',
  'taksitli',
  'installment',
  'gida',
  'sanayi',
  'ticaret',
  'limited',
  'sirketi',
  'anonim',
  'pazarlama',
  'magazacilik',
  'magazalari',
  'perakende',
  'hizmetleri',
  'insaat',
  'ic',
  'dis',
]);

const CATEGORY_CITIES = new Set([
  ...CITIES,
  'gaziantep',
  'mersin',
  'kayseri',
  'eskisehir',
  'samsun',
  'trabzon',
  'izmit',
  'mugla',
  'bodrum',
  'uskudar',
  'bakirkoy',
  'beyoglu',
  'maltepe',
  'kartal',
  'pendik',
  'umraniye',
  'atasehir',
  'cankaya',
  'kecioren',
  'karsiyaka',
  'bornova',
]);

/** A name with a short number ("a101", "n11", "4aotomat"), not a reference code. */
function isNameWithDigits(word: string): boolean {
  return /^\p{L}+\d{1,3}$|^\d{1,3}\p{L}+$/u.test(word);
}

/**
 * The words that can name a merchant, for matching brands and keywords as whole words.
 * "H&M" is kept as one word (`hnm`), since single letters are otherwise dropped.
 * Empty when only a processor or noise is left.
 */
export function merchantWords(description: string): string[] {
  const joined = description.replace(
    /(?<![\p{L}\p{N}])(\p{L})\s*&\s*(\p{L})(?![\p{L}\p{N}])/gu,
    '$1n$2',
  );
  const words = normalizeDescription(joined)
    .split(' ')
    .filter(
      (word) =>
        word.length > 1 &&
        (!/\d/.test(word) || isNameWithDigits(word)) &&
        !CATEGORY_NOISE.has(word) &&
        !CATEGORY_CITIES.has(word),
    );
  while (words.length > 0 && CATEGORY_PROCESSORS.has(words[0]!)) words.shift();
  return words.filter((word, i) => word !== words[i - 1]);
}

/**
 * Who a merchant rule applies to (D22): the merchant key, read from the cleaned words so
 * "IYZICO/4AOTOMAT.COM ISTANBUL 3411" is `4aotomat`. Empty when nothing names a merchant:
 * a rule on a bare processor would catch every shop that uses it.
 */
export function categoryMerchantKey(description: string): string {
  const [first, second] = merchantWords(description);
  if (!first) return '';
  return PLATFORMS.has(first) && second ? `${first} ${second}` : first;
}

/** A key that names only a payment processor, so many different shops can share it. */
export function isProcessorKey(key: string): boolean {
  return CATEGORY_PROCESSORS.has(key);
}

/** The name to show for a merchant rule: "A101", else the D19 display name. */
export function merchantLabel(description: string): string {
  const [first] = merchantWords(description);
  if (first && /\d/.test(first)) return first.toLocaleUpperCase('en');
  return displayName(description);
}
