import { parseCategory, type CategoryRef } from './categories';
import { indexPhrases, type Phrase } from './phrases';

// D22 keywords, as cleaned words with their suffixes spelled out. Only words that mean one
// thing belong here: "gida", "kahve", "elektrik" and "firin" are left out on purpose.

/** "Market" names a grocer only when no other trade is named with it. */
const NOT_A_GROCER = new Set([
  'yapi',
  'oto',
  'pet',
  'petshop',
  'telefon',
  'bilgisayar',
  'elektronik',
  'kitap',
  'cicek',
  'mobilya',
  'tekstil',
  'hirdavat',
  'nalbur',
  'kozmetik',
  'parfum',
  'zuccaciye',
  'yedek',
  'parca',
]);

const KEYWORD_ROWS: readonly (readonly [string, string])[] = [
  ['groceries/supermarket', 'market marketi supermarket bakkal bakkali'],
  ['groceries/fresh', 'manav manavi kasap kasabi sarkuteri sarkuterisi'],
  ['eating-out/restaurant', 'restoran restorani restaurant lokanta lokantasi kebap kebapcisi'],
  ['eating-out/restaurant', 'pideci pidecisi ocakbasi meyhane meyhanesi'],
  ['eating-out/fast-food', 'burger pizza pizzeria doner donercisi'],
  ['eating-out/cafe', 'cafe kafe kafeterya coffee pastane pastanesi'],
  ['transport/fuel', 'akaryakit petrol benzin'],
  ['transport/taxi', 'taksi taxi'],
  ['transport/parking', 'otopark otoparki parking'],
  ['bills/electricity', 'elektrik_fatura elektrik_faturasi'],
  ['bills/gas', 'dogalgaz dogalgaz_faturasi'],
  ['bills/water', 'su_fatura su_faturasi'],
  ['bills/internet', 'internet_fatura internet_faturasi'],
  ['bills/phone', 'telefon_fatura telefon_faturasi'],
  ['shopping/clothing', 'giyim ayakkabi butik butigi'],
  ['shopping/electronics', 'elektronik'],
  ['shopping/home', 'mobilya mobilyasi nalbur hirdavat'],
  ['health/pharmacy', 'eczane eczanesi pharmacy'],
  ['health/hospital', 'hastane hastanesi hospital poliklinik poliklinigi klinik klinigi'],
  ['health/optical', 'optik optigi'],
  ['entertainment/cinema', 'sinema sinemasi cinema'],
  ['entertainment/events', 'tiyatro tiyatrosu theatre konser'],
  ['travel/flights', 'havayolu havayollari airlines airways'],
  ['travel/hotels', 'otel oteli hotel'],
  ['education/school', 'universite universitesi okul okulu kolej koleji'],
  ['education/courses', 'dershane dershanesi kurs kursu'],
  ['education/books', 'kitabevi kirtasiye kirtasiyesi'],
  ['cash/atm', 'atm para_cekme'],
  ['cash/advance', 'nakit_avans'],
];

const KEYWORD_PHRASES: readonly Phrase<CategoryRef>[] = KEYWORD_ROWS.flatMap(([path, words]) => {
  const value = parseCategory(path);
  if (!value) throw new Error(`Unknown category in keyword list: ${path}`);
  return words.split(' ').map((word) => ({
    words: word.split('_'),
    value,
    unless: value.main === 'groceries' ? NOT_A_GROCER : undefined,
  }));
});

export const KEYWORD_INDEX = indexPhrases(KEYWORD_PHRASES);
