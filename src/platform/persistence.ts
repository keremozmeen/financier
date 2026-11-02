/**
 * Asks the browser not to evict IndexedDB under storage pressure (D1).
 * Returns whether storage is persistent; false when the API is unavailable.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
