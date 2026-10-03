interface PreferenceSaveOptions<T extends object> {
  read: () => T | null;
  apply: (prefs: T) => void;
  save: (prefs: T) => Promise<void>;
  status: (state: 'syncing' | 'synced' | 'failed', error?: unknown) => void;
  debounceMs?: number;
}

// Serialize writes: aborting fetch does not undo a write already received by
// the server. Keep a confirmed baseline so failed batches roll back truthfully.
export function createPreferenceSaveQueue<T extends object>(options: PreferenceSaveOptions<T>) {
  let confirmed: T | null = null;
  let desired: T | null = null;
  let version = 0;
  let running = false;
  let pending = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let waiters: Array<{ version: number; resolve: (saved: boolean) => void }> = [];

  const settle = (through: number, saved: boolean) => {
    const done = waiters.filter(waiter => waiter.version <= through);
    waiters = waiters.filter(waiter => waiter.version > through);
    done.forEach(waiter => waiter.resolve(saved));
  };

  const flush = async () => {
    if (disposed || running || !pending || !desired) return;
    pending = false;
    running = true;
    const sentVersion = version;
    const sent = { ...desired };
    try {
      await options.save(sent);
      if (disposed) return;
      confirmed = sent;
      settle(sentVersion, true);
      if (sentVersion === version) options.status('synced');
    } catch (error) {
      if (disposed) return;
      settle(sentVersion, false);
      // An older failure must not overwrite a newer optimistic update.
      if (sentVersion === version && confirmed) {
        desired = { ...confirmed };
        options.apply(desired);
        options.status('failed', error);
      }
    } finally {
      running = false;
      if (!disposed && pending && timer === null) void flush();
    }
  };

  return {
    update(patch: Partial<T>): Promise<boolean> {
      if (disposed) return Promise.resolve(false);
      if (!running && !pending) {
        const current = options.read();
        if (!current) return Promise.resolve(false);
        confirmed = { ...current };
        desired = { ...current };
      }
      desired = { ...desired, ...patch } as T;
      version += 1;
      pending = true;
      options.apply(desired);
      options.status('syncing');
      if (timer !== null) clearTimeout(timer);
      const result = new Promise<boolean>(resolve => waiters.push({ version, resolve }));
      timer = setTimeout(() => {
        timer = null;
        void flush();
      }, options.debounceMs ?? 350);
      return result;
    },
    dispose() {
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      settle(Infinity, false);
    },
  };
}
