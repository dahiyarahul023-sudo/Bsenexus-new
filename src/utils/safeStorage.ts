/**
 * Throw-proof Web Storage reads.
 *
 * `window.localStorage` / `window.sessionStorage` themselves are NULL (not
 * merely throwing) when Web Storage is disabled — e.g. Firefox with
 * `dom.storage.enabled=false`, WebViews with DOM storage off, or enterprise
 * policy. A bare `localStorage.getItem(k)` then throws
 * "Cannot read properties of null (reading 'getItem')" (Sentry BSENEXUS-9),
 * and a `typeof window !== 'undefined'` guard does NOT protect against it.
 * These helpers return null instead of throwing, so call sites degrade to
 * their existing no-storage fallbacks.
 */

function readSafely(kind: 'local' | 'session', key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    const storage = kind === 'local' ? window.localStorage : window.sessionStorage;
    if (!storage) return null;
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** Null-safe `localStorage.getItem` — null when storage is unavailable/disabled. */
export function safeGetItem(key: string): string | null {
  return readSafely('local', key);
}

/** Null-safe `sessionStorage.getItem` — null when storage is unavailable/disabled. */
export function safeSessionGetItem(key: string): string | null {
  return readSafely('session', key);
}
