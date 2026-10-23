import { readAdrSnapshot, type AdrSnapshot } from '../shared/adr';
export function createAdrClient(request: () => Promise<unknown>, clock = Date.now,
  store?: { read: () => unknown; save: (snapshot: AdrSnapshot) => void }) {
  let cached: AdrSnapshot | null = null;
  try { const saved = readAdrSnapshot(store?.read(), clock()); if (saved?.items.length) cached = { ...saved, refreshFailed: true }; } catch {}
  let checked = 0;
  let pending: Promise<AdrSnapshot> | null = null;
  return {
    peek: () => cached ? readAdrSnapshot(cached, clock()) : null,
    load: () => {
      if (cached && clock() - checked < 60000) return Promise.resolve(readAdrSnapshot(cached, clock())!);
      if (pending) return pending;
      pending = request().then(data => {
        let value = readAdrSnapshot(data, clock());
        if (!value || !value.items.length) throw new Error('ADR quotes are unavailable. Try again shortly.');
        const previous = readAdrSnapshot(cached, clock());
        const merged = new Map(value.items.map(item => [item.adrSymbol, item]));
        let retained = false;
        for (const item of previous?.items || []) {
          if (!merged.has(item.adrSymbol) || merged.get(item.adrSymbol)!.sessionDate < item.sessionDate) { merged.set(item.adrSymbol, item); retained = true; }
        }
        if (retained) value = readAdrSnapshot({ ...value, items: [...merged.values()], checkedAt: Math.min(value.checkedAt, previous!.checkedAt), refreshFailed: true }, clock())!;
        cached = value; checked = clock();
        try { store?.save(value); } catch {}
        return value;
      }).catch(error => {
        const saved = readAdrSnapshot(cached, clock());
        if (!saved?.items.length) throw error;
        cached = { ...saved, refreshFailed: true }; checked = clock(); return cached;
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
}, Date.now, {
  read: () => typeof localStorage === 'undefined' ? null : JSON.parse(localStorage.getItem('bse:adr:snapshot:v1') || 'null'),
  save: snapshot => { if (typeof localStorage !== 'undefined') localStorage.setItem('bse:adr:snapshot:v1', JSON.stringify(snapshot)); },
});
