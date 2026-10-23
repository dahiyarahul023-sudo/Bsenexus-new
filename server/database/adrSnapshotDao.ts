import { getSupabase, isSupabaseConfigured } from './supabase.js';
import { readLocalJson, writeLocalJson } from './localStore.js';
import { readAdrSnapshot, type AdrSnapshot } from '../../src/shared/adr.js';

// Public market evidence only. Separate keys never touch the global bot settings.
// Immutable per-session keys avoid an older instance overwriting a newer close.
export const adrSnapshotStore = {
  async read(): Promise<unknown> {
    if (!isSupabaseConfigured()) return readLocalJson('adr-snapshot.json', null);
    const { data, error } = await getSupabase().from('settings').select('key,value')
      .like('key', 'market:adr:v1:%').order('key', { ascending: false }).limit(40)
      .abortSignal(AbortSignal.timeout(2000));
    if (error) throw error;
    const items = (data || []).flatMap(row => readAdrSnapshot(row.value)?.items || []);
    const checkedAt = Math.min(Date.now(), ...(data || []).map(row => Number(row.value?.checkedAt) || 0));
    return { checkedAt, items, refreshFailed: true };
  },
  async save(snapshot: AdrSnapshot): Promise<void> {
    if (!snapshot.items.length) return;
    if (!isSupabaseConfigured()) { writeLocalJson('adr-snapshot.json', snapshot); return; }
    const rows = snapshot.items.map(item => ({ key: `market:adr:v1:${item.sessionDate}:${item.adrSymbol}`,
      value: { checkedAt: snapshot.checkedAt, items: [item] } }));
    const { error } = await getSupabase().from('settings').upsert(rows, { onConflict: 'key', ignoreDuplicates: true })
      .abortSignal(AbortSignal.timeout(2000));
    if (error) throw error;
  },
};
