import { matchStockInText } from '../shared/newsRelevance';
export interface HomeNewsItem {
  id: string; title: string; link: string; source: string;
  snippet: string; publishedAt: string; category: string; symbol?: string;
}

export function safeNewsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function readHomeNews(payload: unknown): HomeNewsItem[] {
  const data = payload as any;
  if (data?.success === false) throw new Error('News unavailable');
  const items = Array.isArray(data) ? data : data?.items;
  if (!Array.isArray(items)) throw new Error('Invalid news response');
  return items.slice(0, 300).flatMap((item: any) => {
    const link = safeNewsUrl(item?.link);
    if (item?.hasArticleLink === false || !link || typeof item?.title !== 'string' || !item.title.trim()) return [];
    return [{ id: String(item.id || link), link, title: item.title.trim(),
      snippet: typeof item.snippet === 'string' ? item.snippet.trim() : '',
      source: typeof item.source === 'string' && item.source.trim() ? item.source.trim() : 'Publisher',
      publishedAt: item.publicationTimeKnown !== false && typeof item.publishedAt === 'string' ? item.publishedAt : '',
      category: typeof item.category === 'string' ? item.category : 'market',
      symbol: typeof item.symbol === 'string' ? item.symbol : undefined }];
  });
}

// Editorial ordering, not a verified severity or stock recommendation.
// Prefer fresh market/regulatory/results news; give material policy headlines
// and exact watchlist terms a bounded boost. Unknown dates get no freshness.
export function selectHomeNews(items: HomeNewsItem[], watched: string[] = [], now = Date.now(), watchlistOnly = false): HomeNewsItem[] {
  const relevant = (item: HomeNewsItem) => watched.some(term =>
    item.symbol?.toUpperCase() === term.toUpperCase() || matchStockInText(`${item.title} ${item.snippet}`,term,term));
  const scored = (watchlistOnly ? items.filter(relevant) : items).map(item => {
    const ts = Date.parse(item.publishedAt);
    const validDate = Number.isFinite(ts) && ts <= now + 5 * 60_000;
    const ageHours = validDate ? Math.max(0, (now - ts) / 3_600_000) : Infinity;
    const fresh = ageHours <= 48;
    const title = item.title.toLowerCase();
    const personal = relevant(item);
    const impact = /\b(rbi|repo rate|monetary policy|union budget|sebi|rate cut|rate hike|inflation|gdp|market crash)\b/i.test(title) ? 24 : 0;
    const category = ({ regulatory: 18, earnings: 16, market: 14, corporate: 8 } as Record<string, number>)[item.category] || 4;
    return { item, fresh, ts: validDate ? ts : 0,
      score: (fresh ? Math.max(0, 30 - ageHours) + (impact + category + (personal ? 12 : 0)) * Math.max(0.15, 1 - ageHours / 24) : 0) };
  }).sort((a, b) => Number(b.fresh) - Number(a.fresh) || b.score - a.score || b.ts - a.ts || a.item.id.localeCompare(b.item.id));
  const seenLinks = new Set<string>();
  const seenTitles: string[][] = [];
  const selected: HomeNewsItem[] = [];
  for (const { item } of scored) {
    const url = new URL(item.link); url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/i.test(key)) url.searchParams.delete(key);
    const tokens = [...new Set(item.title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(x => x.length > 2))];
    const duplicateTitle = seenTitles.some(other => {
      const overlap = tokens.filter(x => other.includes(x)).length;
      return overlap / Math.max(1, Math.max(tokens.length, other.length)) >= 0.8;
    });
    if (seenLinks.has(url.href) || duplicateTitle) continue;
    seenLinks.add(url.href); seenTitles.push(tokens); selected.push(item);
    if (selected.length === 3) break;
  }
  return selected;
}

export function newsSignature(items: HomeNewsItem[]) {
  return JSON.stringify(items.map(({ id, title, link, snippet, source, publishedAt }) => [id, title, link, snippet, source, publishedAt]));
}

export interface HomeNewsState {
  displayed: HomeNewsItem[]; pending: HomeNewsItem[] | null;
  loading: boolean; error: boolean; checkedAt: number | null;
}

// Request/state owner shared by hook and behavior tests. Each account gets a
// new instance; abort + generation fences keep late responses out of the UI.
export class HomeNewsFeed {
  private state: HomeNewsState = { displayed: [], pending: null, loading: false, error: false, checkedAt: null };
  private listeners = new Set<() => void>();
  private generation = 0;
  private request: AbortController | null = null;
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(update: Partial<HomeNewsState>) { this.state = { ...this.state, ...update }; this.listeners.forEach(fn => fn()); }
  async refresh(fetcher: (signal: AbortSignal) => Promise<unknown>, select: (items: HomeNewsItem[]) => HomeNewsItem[]) {
    if (this.request) return;
    const request = new AbortController(); this.request = request;
    const generation = ++this.generation;
    this.update({ loading: true });
    try {
      const next = select(readHomeNews(await fetcher(request.signal)));
      if (request.signal.aborted || generation !== this.generation) return;
      if (!next.length && this.state.displayed.length) throw new Error('Empty refresh');
      const changed = newsSignature(next) !== newsSignature(this.state.displayed);
      this.update({ error: false, checkedAt: Date.now(),
        ...(this.state.displayed.length && changed ? { pending: next } : { displayed: next, pending: null }) });
    } catch {
      if (!request.signal.aborted && generation === this.generation) this.update({ error: true });
    } finally {
      if (generation === this.generation) { this.request = null; this.update({ loading: false }); }
    }
  }
  accept() {
    if (this.state.pending) this.update({ displayed: this.state.pending, pending: null });
  }
  cancel() { this.generation++; this.request?.abort(); this.request = null; this.update({ loading: false }); }
}
