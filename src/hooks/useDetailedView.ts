import { useCallback, useSyncExternalStore } from 'react';
import { readPreference, writePreference } from '../platform/storage';

const STORAGE_KEY = 'financier.detailedView';
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

const read = () => readPreference(STORAGE_KEY) === 'on';

/**
 * The "Detailed view" setting (D20): off by default. When on, screens show their full
 * sections inline (every card's gauge, the cash-flow chart, every row).
 */
export function useDetailedView(): [boolean, (on: boolean) => void] {
  const detailed = useSyncExternalStore(subscribe, read, () => false);
  const setDetailed = useCallback((on: boolean) => {
    writePreference(STORAGE_KEY, on ? 'on' : 'off');
    for (const listener of listeners) listener();
  }, []);
  return [detailed, setDetailed];
}
