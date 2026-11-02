/** Bounded, process-local read cache. Failures are never cached. */
export class ReadCache<T> {
  private values = new Map<string, { value: T; expiresAt: number }>();
  private pending = new Map<string, Promise<T>>();

  constructor(private options: {
    maxEntries: number;
    ttlMs: (value: T) => number;
    now?: () => number;
  }) {}

  clear() {
    this.values.clear();
    this.pending.clear();
  }

  invalidate(key: string) {
    this.values.delete(key);
    // A load that started before a write must not repopulate the cache.
    this.pending.delete(key);
  }

  async get(key: string, load: () => Promise<T>): Promise<T> {
    const now = this.options.now || Date.now;
    const cached = this.values.get(key);
    if (cached && cached.expiresAt > now()) {
      this.values.delete(key);
      this.values.set(key, cached);
      return cached.value;
    }
    this.values.delete(key);
    const pending = this.pending.get(key);
    if (pending) return pending;
    // Unique cold requests cannot grow the pending registry without bound.
    if (this.pending.size >= this.options.maxEntries) return load();
    const startedAt = now();
    const request: Promise<T> = Promise.resolve().then(load).then(value => {
      if (this.pending.get(key) === request) {
        const expiresAt = startedAt + this.options.ttlMs(value);
        if (expiresAt > now()) {
          while (this.values.size >= this.options.maxEntries) {
            this.values.delete(this.values.keys().next().value!);
          }
          this.values.set(key, { value, expiresAt });
        }
      }
      return value;
    }).finally(() => {
      if (this.pending.get(key) === request) this.pending.delete(key);
    });
    this.pending.set(key, request);
    return request;
  }
}
