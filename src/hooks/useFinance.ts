import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { todayIso } from '../core/finance';
import { cardsRepo, loadCardSummaries, loadUsageInputs, transactionsRepo } from '../db';

// Live queries re-run whenever the tables they read change.
// `undefined` means still loading; `null` means not found.

export function useToday() {
  const [today] = useState(todayIso);
  return today;
}

export function useCards({ includeArchived = false } = {}) {
  return useLiveQuery(() => cardsRepo.list({ includeArchived }), [includeArchived]);
}

/** Active cards with their summary: limit usage for credit, this month's spending for debit. */
export function useCardSummaries() {
  const today = useToday();
  return useLiveQuery(async () => loadCardSummaries(await cardsRepo.list(), today), [today]);
}

export function useCardDetail(id: string) {
  const today = useToday();
  return useLiveQuery(async () => {
    const card = await cardsRepo.get(id);
    if (!card) return null;
    const [[summary], transactions, plans] = await Promise.all([
      loadCardSummaries([card], today),
      transactionsRepo.listByCard(id),
      transactionsRepo.listPlansByCard(id),
    ]);
    return { summary: summary!, transactions, plans };
  }, [id, today]);
}

/** A card plus, for credit cards, the usage input D12 checks new entries against. */
export function useCardForEntry(id: string) {
  const today = useToday();
  return useLiveQuery(async () => {
    const card = await cardsRepo.get(id);
    if (!card) return null;
    if (card.type === 'debit') return { card, usageInput: undefined };
    const [usageInput] = await loadUsageInputs([card], today);
    return { card, usageInput: usageInput! };
  }, [id, today]);
}
