import { useLiveQuery } from 'dexie-react-hooks';
import { cardsRepo, importsRepo } from '../db';
import type { Card } from '../types/domain';

/** Past imports, newest first, with their card (archived cards included). */
export function useImportHistory() {
  return useLiveQuery(async () => {
    const [records, cards] = await Promise.all([
      importsRepo.list(),
      cardsRepo.list({ includeArchived: true }),
    ]);
    const byId = new Map(cards.map((card) => [card.id, card]));
    return records.map((record) => ({ record, card: byId.get(record.cardId) }));
  }, []);
}

/** What the review screen checks an import against (D3, D16); live, so it stays current. */
export function useImportContext(card: Card | undefined) {
  return useLiveQuery(
    () => (card ? importsRepo.loadContext(card) : undefined),
    [card?.id, card?.type, card?.type === 'credit' ? card.autoPay : undefined],
  );
}
