import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { db } from '../db/database';

// Node 25+ ships its own global localStorage, which shadows jsdom's and is
// unusable without --localstorage-file. Swap in a plain in-memory Storage.
if (typeof window.localStorage?.getItem !== 'function') {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(key, String(value)),
  };
  Object.defineProperty(window, 'localStorage', { value: memoryStorage, configurable: true });
}

afterEach(async () => {
  cleanup();
  window.localStorage.clear();
  await Promise.all(db.tables.map((table) => table.clear()));
});
