import { foldText } from '../../parsers/common/text';

/**
 * A bank (or card issuer) the app knows (D21): its display name, its initials as its
 * mark, and its brand color for the mark and card tiles. Colors are
 * deep enough for white text unless `ink` says otherwise.
 */
export interface Bank {
  id: string;
  name: string;
  mark: string;
  color: string;
  /** Mark text color on `color`; white when missing. */
  ink?: string;
  /**
   * Folded words that identify the bank in a card's bank or name: the bank's own
   * names and its card brands ("Bonus" is Garanti BBVA, "Axess" is Akbank).
   */
  keywords: readonly string[];
}

export const BANKS: readonly Bank[] = [
  {
    id: 'garanti',
    name: 'Garanti BBVA',
    mark: 'G',
    color: '#1f7a4d',
    keywords: ['garanti', 'bonus', 'bbva'],
  },
  {
    id: 'yapikredi',
    name: 'Yapı Kredi',
    mark: 'YK',
    color: '#0a3d8f',
    keywords: ['yapi kredi', 'yapikredi', 'ykb', 'world'],
  },
  {
    id: 'isbank',
    name: 'İş Bankası',
    mark: 'İŞ',
    color: '#0b4ea2',
    keywords: ['is bankasi', 'isbank', 'is bank', 'maximum'],
  },
  {
    id: 'akbank',
    name: 'Akbank',
    mark: 'AK',
    color: '#c8102e',
    keywords: ['akbank', 'axess', 'wings'],
  },
  {
    id: 'qnb',
    name: 'QNB',
    mark: 'QNB',
    color: '#5b1f69',
    keywords: ['qnb', 'finansbank', 'cardfinans'],
  },
  { id: 'enpara', name: 'Enpara', mark: 'EN', color: '#4b2a85', keywords: ['enpara'] },
  {
    id: 'ziraat',
    name: 'Ziraat Bankası',
    mark: 'Z',
    color: '#c4161c',
    keywords: ['ziraat', 'bankkart'],
  },
  {
    id: 'halkbank',
    name: 'Halkbank',
    mark: 'H',
    color: '#00589f',
    keywords: ['halkbank', 'halk bankasi', 'paraf'],
  },
  {
    id: 'vakifbank',
    name: 'VakıfBank',
    mark: 'V',
    color: '#f2b100',
    ink: '#14161b',
    keywords: ['vakifbank', 'vakif bank', 'vakiflar'],
  },
  {
    id: 'denizbank',
    name: 'DenizBank',
    mark: 'D',
    color: '#00609c',
    keywords: ['denizbank', 'deniz bank'],
  },
  { id: 'teb', name: 'TEB', mark: 'TEB', color: '#00804a', keywords: ['teb', 'cepteteb'] },
  { id: 'ing', name: 'ING', mark: 'ING', color: '#c04400', keywords: ['ing'] },
  {
    id: 'kuveytturk',
    name: 'Kuveyt Türk',
    mark: 'KT',
    color: '#006a4e',
    keywords: ['kuveyt turk', 'kuveytturk'],
  },
  { id: 'hsbc', name: 'HSBC', mark: 'HSBC', color: '#b5000f', keywords: ['hsbc', 'advantage'] },
  { id: 'sekerbank', name: 'Şekerbank', mark: 'Ş', color: '#00744f', keywords: ['sekerbank'] },
  { id: 'fibabanka', name: 'Fibabanka', mark: 'F', color: '#1f3a93', keywords: ['fibabanka'] },
  { id: 'odeabank', name: 'Odeabank', mark: 'O', color: '#6b1d5c', keywords: ['odeabank'] },
  { id: 'papara', name: 'Papara', mark: 'P', color: '#1b1b1b', keywords: ['papara'] },
];

const byId = new Map(BANKS.map((bank) => [bank.id, bank]));

export function bankById(id: string): Bank | undefined {
  return byId.get(id);
}

/**
 * The bank a card belongs to: its bank text first, then its name, matched on whole
 * folded words ("Garanti BBVA", "garanti", "Bonus Platinum" all find Garanti BBVA).
 */
export function matchBank(...texts: readonly (string | undefined)[]): Bank | undefined {
  for (const text of texts) {
    if (!text) continue;
    const folded = ` ${foldText(text).replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
    const bank = BANKS.find((candidate) =>
      candidate.keywords.some((keyword) => folded.includes(` ${keyword} `)),
    );
    if (bank) return bank;
  }
  return undefined;
}
