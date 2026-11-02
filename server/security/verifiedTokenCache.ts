import { createHash } from 'node:crypto';

/**
 * Short-lived cache for verified Firebase ID tokens (PERF-1).
 *
 * Every API call from the browser carries the Firebase ID token, and the auth
 * middleware verified it with `verifyIdToken(token, true)`. The `true` makes the
 * Admin SDK ask Google's identity backend whether the user was revoked or
 * disabled, so EVERY request paid one extra network round trip, and a page that
 * fires several calls at once paid it several times in parallel.
 *
 * This keeps the same check but runs it once per token per window:
 *  - only successful verifications are cached; failures are never cached
 *  - an entry never outlives the token's own `exp`
 *  - identical tokens verified at the same moment share ONE in-flight check
 *  - the key is a SHA-256 of the token, so the raw token is never stored
 *
 * Trade-off (accepted, documented): a user revoked or disabled in the Firebase
 * console can keep using an already-verified token for at most `ttlMs`
 * (default 60 s) instead of instantly. The app itself never revokes tokens.
 * Callers must treat the returned claims as read-only.
 */
export interface VerifiedTokenCacheOptions {
  /** Max time a verification is reused. 0 disables caching and sharing. */
  ttlMs: number;
  maxEntries?: number;
  now?: () => number;
}

export interface VerifiedTokenCache<T> {
  verify(token: string, verifier: (token: string) => Promise<T>): Promise<T>;
  clear(): void;
  size(): number;
}

export const DEFAULT_VERIFY_CACHE_MS = 60_000;
export const MAX_VERIFY_CACHE_MS = 5 * 60_000;

/** Resolve the window from the environment. Off in tests so mocks stay exact. */
export function resolveVerifyCacheMs(env: NodeJS.ProcessEnv = process.env): number {
  if (env.NODE_ENV === 'test' || env.NODE_TEST_CONTEXT) return 0;
  const raw = env.FIREBASE_VERIFY_CACHE_MS;
  if (raw === undefined || raw.trim() === '') return DEFAULT_VERIFY_CACHE_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.floor(parsed), MAX_VERIFY_CACHE_MS);
}

export function createVerifiedTokenCache<T extends { exp?: number }>(
  options: VerifiedTokenCacheOptions,
): VerifiedTokenCache<T> {
  const now = options.now ?? Date.now;
  const maxEntries = Number.isFinite(options.maxEntries)
    ? Math.max(1, Math.floor(options.maxEntries!)) : 2000;
  const entries = new Map<string, { value: T; expiresAt: number }>();
  const inflight = new Map<string, Promise<T>>();
  let generation = 0;
  const keyOf = (token: string) => createHash('sha256').update(token).digest('hex');

  const evictIfFull = () => {
    if (entries.size < maxEntries) return;
    const t = now();
    for (const [k, v] of entries) if (v.expiresAt <= t) entries.delete(k);
    // Still full: drop the oldest insertions (Map keeps insertion order).
    while (entries.size >= maxEntries) {
      const oldest = entries.keys().next();
      if (oldest.done) break;
      entries.delete(oldest.value);
    }
  };

  return {
    async verify(token, verifier) {
      if (options.ttlMs <= 0) return verifier(token);
      const key = keyOf(token);
      const hit = entries.get(key);
      if (hit) {
        if (hit.expiresAt > now()) return hit.value;
        entries.delete(key);
      }
      const pending = inflight.get(key);
      if (pending) return pending;
      // Unique invalid tokens cannot grow the retained in-flight map forever.
      if (inflight.size >= maxEntries) return verifier(token);

      const startedGeneration = generation;
      const run = (async () => {
        const value = await verifier(token);
        const tokenExpiryMs = typeof value?.exp === 'number' && Number.isFinite(value.exp)
          ? value.exp * 1000 : 0;
        const expiresAt = Math.min(now() + options.ttlMs, tokenExpiryMs);
        if (startedGeneration === generation && expiresAt > now()) {
          evictIfFull();
          entries.set(key, { value, expiresAt });
        }
        return value;
      })();
      inflight.set(key, run);
      try {
        return await run;
      } finally {
        if (inflight.get(key) === run) inflight.delete(key);
      }
    },
    clear() {
      generation++;
      entries.clear();
      inflight.clear();
    },
    size() {
      return entries.size;
    },
  };
}
