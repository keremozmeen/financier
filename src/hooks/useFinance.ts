import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { todayIso } from '../core/finance';
import { cardsRepo, loadCardsWithUsage, loadUsageInputs, transactionsRepo } from '../db';

// Live queries re-run whenever the tables they read change.
// `undefined` means still loading; `null` means not found.

export function useToday() {
  const [today] = useState(todayIso);
  return today;
}

export function useCards({ includeArchived = false } = {}) {
  return useLiveQuery(() => cardsRepo.list({ includeArchived }), [includeArchived]);
}

/** Active cards with their D11 usage. */
export function useCardsWithUsage() {
  const today = useToday();
  return useLiveQuery(async () => loadCardsWithUsage(await cardsRepo.list(), today), [today]);
}

export function useCardDetail(id: string) {
  const today = useToday();
  return useLiveQuery(async () => {
    const card = await cardsRepo.get(id);
    if (!card) return null;
    const [[withUsage], transactions, plans] = await Promise.all([
      loadCardsWithUsage([card], today),
      transactionsRepo.listByCard(id),
      transactionsRepo.listPlansByCard(id),
    ]);
    return { card, usage: withUsage!.usage, transactions, plans };
  }, [id, today]);
}

/** A card plus the usage input D12 checks new entries against. */
export function useCardForEntry(id: string) {
  const today = useToday();
  return useLiveQuery(async () => {
    const card = await cardsRepo.get(id);
    if (!card) return null;
    const [usageInput] = await loadUsageInputs([card], today);
    return { card, usageInput: usageInput! };
  }, [id, today]);
}
