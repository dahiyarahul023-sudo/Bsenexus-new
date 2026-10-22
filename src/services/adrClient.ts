import { readAdrSnapshot, type AdrSnapshot } from '../shared/adr';
export function createAdrClient(request: () => Promise<unknown>, clock = Date.now) {
  let cached: AdrSnapshot | null = null;
  let checked = 0;
  let pending: Promise<AdrSnapshot> | null = null;
  return {
    peek: () => cached ? readAdrSnapshot(cached, clock()) : null,
    load: () => {
      if (cached && clock() - checked < 60000) return Promise.resolve(readAdrSnapshot(cached, clock())!);
      if (pending) return pending;
      pending = request().then(data => {
        const value = readAdrSnapshot(data, clock());
        if (!value || !value.items.length) throw new Error('ADR quotes are unavailable. Try again shortly.');
        cached = value; checked = clock(); return value;
      }).finally(() => { pending = null; });
      return pending;
    },
  };
}
export const adrClient = createAdrClient(async () => {
  const { customFetch } = await import('../api');
  const response = await customFetch('/api/market/adr', { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('ADR quotes could not be checked. Try again.');
  return response.json();
});
