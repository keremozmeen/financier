// Whole-word phrase matching over cleaned merchant words (D22). There is no substring
// matching anywhere: "migrosluk" is not Migros.

export interface Phrase<T> {
  words: readonly string[];
  value: T;
  /** Only counts as the merchant's first word, for names that are also common words. */
  leadingOnly?: boolean;
  /** The match is ignored when any of these words is present. */
  unless?: ReadonlySet<string>;
}

export type PhraseIndex<T> = Map<string, Phrase<T>[]>;

/** Indexes phrases by first word, longest first, so "amazon prime" beats "amazon". */
export function indexPhrases<T>(phrases: readonly Phrase<T>[]): PhraseIndex<T> {
  const index: PhraseIndex<T> = new Map();
  for (const phrase of phrases) {
    const bucket = index.get(phrase.words[0]!) ?? [];
    bucket.push(phrase);
    index.set(phrase.words[0]!, bucket);
  }
  for (const bucket of index.values()) bucket.sort((a, b) => b.words.length - a.words.length);
  return index;
}

/** The earliest phrase found in the words. */
export function findPhrase<T>(words: readonly string[], index: PhraseIndex<T>): T | undefined {
  for (let start = 0; start < words.length; start++) {
    for (const phrase of index.get(words[start]!) ?? []) {
      if (phrase.leadingOnly && start > 0) continue;
      if (!phrase.words.every((word, i) => words[start + i] === word)) continue;
      if (phrase.unless && words.some((word) => phrase.unless!.has(word))) continue;
      return phrase.value;
    }
  }
  return undefined;
}
