import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { dueSoon, todayIso } from '../core/finance';
import {
  cardsRepo,
  loadCardSummaries,
  loadDashboard,
  loadSubRadar,
  loadUsageInputs,
  paymentsRepo,
  transactionsRepo,
} from '../db';
import { setAppBadge } from '../platform/badge';

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
    const [[summary], transactions, plans, payments] = await Promise.all([
      loadCardSummaries([card], today),
      transactionsRepo.listByCard(id),
      transactionsRepo.listPlansByCard(id),
      paymentsRepo.listByCard(id),
    ]);
    return { summary: summary!, transactions, plans, payments };
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

/** Cards, next bills, the cash-flow projection and recent activity (D14). */
export function useDashboard() {
  const today = useToday();
  return useLiveQuery(() => loadDashboard(today), [today]);
}

/** Keeps the app icon badge at the number of payments due within 7 days (D5). */
export function useDueSoonBadge() {
  const today = useToday();
  const count = useLiveQuery(
    async () => dueSoon((await loadDashboard(today)).bills, today).length,
    [today],
  );
  useEffect(() => {
    if (count !== undefined) setAppBadge(count);
  }, [count]);
}

/**
 * Records auto-pay payments (D14) whenever the app opens or an auto-pay setting
 * changes. The repository makes repeated runs safe.
 */
export function useAutoPay() {
  const today = useToday();
  const key = useLiveQuery(async () => {
    const cards = await cardsRepo.list();
    return cards
      .flatMap((card) =>
        card.type === 'credit' && card.autoPay ? [`${card.id}:${card.autoPaySince}`] : [],
      )
      .join(',');
  }, []);
  useEffect(() => {
    if (key) void paymentsRepo.applyAutoPayments(today);
  }, [key, today]);
}

/** Subscriptions, bills and their alerts (D19), recomputed when entries or choices change. */
export function useSubRadar() {
  const today = useToday();
  return useLiveQuery(() => loadSubRadar(today), [today]);
}
