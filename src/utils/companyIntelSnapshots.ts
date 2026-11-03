// Ephemeral public-data snapshots are still isolated by account and exact selection.
// Never renew freshness on a hit or persist private account state in localStorage.
const snapshots = new Map<string, { data: any; at: number }>();
export function readCompanyIntelSnapshot(key: string, now = Date.now()) {
  const snapshot = snapshots.get(key);
  if (!snapshot || now < snapshot.at || now - snapshot.at > 5 * 60_000) { snapshots.delete(key); return null; }
  return snapshot;
}
export function storeCompanyIntelSnapshot(key: string, data: any, now = Date.now()) {
  snapshots.delete(key);
  while (snapshots.size >= 12) snapshots.delete(snapshots.keys().next().value!);
  snapshots.set(key, { data, at: now });
}
export function clearCompanyIntelSnapshots() { snapshots.clear(); }
