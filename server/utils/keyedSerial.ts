/** Serialize one process's operations per key; this is NOT a distributed lock. */
export function createKeyedSerial() {
  const tails = new Map<string, Promise<void>>();
  return async function serial<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) || Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>(resolve => { release = resolve; });
    const tail = previous.then(() => mine);
    tails.set(key, tail);
    await previous;
    try { return await operation(); }
    finally {
      release();
      if (tails.get(key) === tail) tails.delete(key);
    }
  };
}
