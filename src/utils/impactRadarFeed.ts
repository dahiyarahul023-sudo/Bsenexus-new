import { isRadarEvent, publicRadarEvent, type RadarEvent } from '../shared/impactRadar';

type Request = (url: string, options?: RequestInit) => Promise<Response>;
export interface RadarFeedState {
  items: RadarEvent[]; pending: RadarEvent[] | null; following: string[];
  followingReady: boolean; followingError: boolean; saving: string[];
  loading: boolean; checkedAt: number | null; error: string | null; sourceUnavailable: boolean;
  actionError: string | null; sourceStale: boolean;
  sourceCheckedAt: number | null; sourcePending: boolean; newsUnavailable: boolean;
}
const merge = (items: RadarEvent[], followed: RadarEvent[]) => [...new Map([...followed, ...items].map(e => [e.id, e])).values()];
export class ImpactRadarFeed {
  private state: RadarFeedState;
  private listeners = new Set<() => void>();
  private read: AbortController | null = null;
  private writes = new Map<string, AbortController>();
  private revision = 0;
  private followingRevision = 0;
  constructor(private identity: string, private request: Request) {
    this.state = { items: [], pending: null, following: [], followingReady: identity === 'guest', followingError: false,
      saving: [], loading: false, checkedAt: null, error: null, sourceUnavailable: false, sourceStale: false, actionError: null, sourceCheckedAt:null,sourcePending:true,newsUnavailable:false };
  }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getSnapshot = () => this.state;
  private set(patch: Partial<RadarFeedState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  cancelRead = () => { this.revision++; this.read?.abort(); this.read = null; if (this.state.loading) this.set({ loading: false }); };
  dispose = () => { this.cancelRead(); this.writes.forEach(c => c.abort()); this.writes.clear(); this.set({ saving: [] }); };
  accept = () => { if (this.state.pending) this.set({ items: this.state.pending, pending: null }); };
  async refresh() {
    if (this.read) return;
    const controller = new AbortController(); this.read = controller;
    const revision = ++this.revision, followRevision = this.followingRevision;
    const timeout = setTimeout(() => controller.abort(), 20_000);
    this.set({ loading: true });
    try {
      const [result, followed] = await Promise.allSettled([
        this.request('/api/impact-radar', { signal: controller.signal }).then(async r => { if (!r.ok) throw new Error('Radar unavailable'); return r.json(); }),
        this.identity === 'guest' ? Promise.resolve({ ids: [], events: [] }) :
          this.request('/api/impact-radar/following', { signal: controller.signal }).then(async r => { if (!r.ok) throw new Error('Tracking unavailable'); return r.json(); }),
      ]);
      if (revision !== this.revision) return;
      if (controller.signal.aborted) throw new Error('Radar check timed out. Please retry.');
      if (followed.status === 'fulfilled' && followed.value.success !== false && Array.isArray(followed.value.ids) && Array.isArray(followed.value.events)) {
        if (followRevision === this.followingRevision && !this.writes.size) this.set({ following: followed.value.ids.filter((x: unknown) => typeof x === 'string'), followingReady: true, followingError: false, actionError: null });
      } else this.set({ followingError: true });
      if (result.status !== 'fulfilled' || result.value.success !== true || !Array.isArray(result.value.items)) throw new Error('Could not check Impact Radar. Please retry.');
      if (result.value.items.some((e: unknown) => !isRadarEvent(e))) throw new Error('The radar response could not be verified. Please retry.');
      const extra = followed.status === 'fulfilled' && followed.value.success !== false && Array.isArray(followed.value.events) ? followed.value.events.filter(e => isRadarEvent(e)) :
        [...this.state.items, ...(this.state.pending || [])].filter(e => this.state.following.includes(e.id));
      const items = merge(result.value.items.map(publicRadarEvent), extra);
      const changed = JSON.stringify(items) !== JSON.stringify(this.state.items);
      this.set({ ...(this.state.checkedAt !== null && this.state.items.length && changed ? { pending: items } : { items, pending: null }),
        checkedAt: Date.now(), error: null, sourceUnavailable: result.value.intake?.unavailable === true, sourceStale: result.value.intake?.stale === true,
        sourceCheckedAt: typeof result.value.intake?.checkedAt === 'number' ? result.value.intake.checkedAt : null,
        sourcePending: result.value.intake?.pending === true, newsUnavailable:result.value.intake?.newsUnavailable === true });
    } catch (e) {
      if (revision === this.revision) this.set({ error: controller.signal.aborted ? 'Radar check timed out. Please retry.' : (e as Error).message });
    } finally {
      clearTimeout(timeout);
      if (revision === this.revision) { this.read = null; this.set({ loading: false }); }
    }
  }
  async toggle(id: string): Promise<void> {
    if (this.identity === 'guest' || !this.state.followingReady || this.writes.has(id)) return;
    const followed = !this.state.following.includes(id), controller = new AbortController();
    this.writes.set(id, controller); ++this.followingRevision;
    this.set({ saving: [...this.writes.keys()], actionError: null });
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const r = await this.request(`/api/impact-radar/${encodeURIComponent(id)}/follow`, { method: 'PUT', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ followed }) });
      const data = await r.json();
      if (!r.ok || data.success !== true || data.id !== id || data.followed !== followed) throw new Error('Tracking was not confirmed. Refresh or retry.');
      if (controller.signal.aborted || this.writes.get(id) !== controller) return;
      const ids = new Set(this.state.following); followed ? ids.add(id) : ids.delete(id);
      this.set({ following: [...ids], actionError: null });
    } catch {
      if (this.writes.get(id) === controller) this.set({ actionError: 'Tracking could not be confirmed. Refresh to check its status, then retry.' });
    } finally {
      clearTimeout(timeout);
      if (this.writes.get(id) === controller) { this.writes.delete(id); ++this.followingRevision; this.set({ saving: [...this.writes.keys()] }); }
    }
  }
}
