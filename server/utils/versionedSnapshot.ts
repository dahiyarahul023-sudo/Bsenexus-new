export interface SnapshotVersion { id: string; version: string }
export interface SnapshotRow<T> extends SnapshotVersion { value: T }
export interface SnapshotBatch<T> { rows: SnapshotRow<T>[]; checkedAt: number }

/** Refresh small versions, downloading values only when their version changes.
 * The loader must page the complete owner inventory, including empty rows.
 * This cache is for background reads; it must never authorize a write.
 */
export class VersionedSnapshot<T> {
  private rows = new Map<string, SnapshotRow<T>>();
  private snapshot: SnapshotRow<T>[] | null = null;
  private fetchedAt = -Infinity;
  private generation = 0;
  private pending: Promise<SnapshotBatch<T>> | null = null;

  constructor(private options: {
    loadVersions: () => Promise<SnapshotVersion[]>;
    loadRows: (ids: string[]) => Promise<SnapshotRow<T>[]>;
    ttlMs: number;
    now?: () => number;
  }) {}

  invalidate() {
    this.generation++;
    this.snapshot = null;
    this.pending = null;
  }

  isCurrent(batch: SnapshotBatch<T>): boolean {
    return this.snapshot === batch.rows;
  }

  async get(): Promise<SnapshotBatch<T>> {
    const now = this.options.now || Date.now;
    if (this.snapshot && now() - this.fetchedAt < this.options.ttlMs) return { rows: this.snapshot, checkedAt: this.fetchedAt };
    if (this.pending) return this.pending;
    const generation = this.generation;
    const startedAt = now();
    const request: Promise<SnapshotBatch<T>> = Promise.resolve().then(async () => {
      const versions = await this.options.loadVersions();
      const changed = versions.filter(row => this.rows.get(row.id)?.version !== row.version);
      const loaded = changed.length ? await this.options.loadRows(changed.map(row => row.id)) : [];
      const byId = new Map(loaded.map(row => [row.id, row]));
      const next = new Map<string, SnapshotRow<T>>();
      for (const version of versions) {
        const row = byId.get(version.id) || (this.rows.get(version.id)?.version === version.version ? this.rows.get(version.id) : undefined);
        // A row deleted between the version scan and value fetch stays absent.
        if (row) next.set(row.id, row);
      }
      if (generation !== this.generation) return this.get();
      this.rows = next;
      this.snapshot = [...next.values()];
      this.fetchedAt = startedAt;
      return { rows: this.snapshot, checkedAt: this.fetchedAt };
    }).finally(() => {
      if (this.pending === request) this.pending = null;
    });
    this.pending = request;
    return request;
  }
}
