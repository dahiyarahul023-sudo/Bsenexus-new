import { createHash } from 'node:crypto';

export interface IndexNowPage { url: string; version: string }
export interface IndexNowClaim { url: string; token: string; version: string }
export interface IndexNowStore {
  enqueue(pages: IndexNowPage[]): Promise<void>;
  claim(): Promise<IndexNowClaim[]>;
  complete(claims: IndexNowClaim[], status: number): Promise<void>;
}
export const contentVersion = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function indexNowUrl(input: string): string | null {
  try {
    const u = new URL(input);
    if (u.origin !== 'https://bsenexus.in' || u.username || u.password || u.search || u.hash) return null;
    if (u.pathname.startsWith('/company/')) {
      const symbol = decodeURIComponent(u.pathname.slice('/company/'.length));
      if (!/^[A-Z0-9&.-]{2,20}$/.test(symbol)) return null;
      u.pathname = `/company/${encodeURIComponent(symbol)}`;
    } else if (!/^\/(?:companies|announcements|guides\/[a-z0-9-]+)$/.test(u.pathname)) return null;
    return u.href;
  } catch { return null; }
}

/** Ingestion only adds to this in-process batch; all I/O runs outside its call stack. */
export class IndexNowQueue {
  private queue = new Map<string, IndexNowPage>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private interval: ReturnType<typeof setInterval> | undefined;
  private running: Promise<{ success: boolean; submittedCount: number; error?: string }> | undefined;
  private activeBatches = 0;
  private stats = { totalSubmittedUrls: 0, successfulBatches: 0, failedBatches: 0, lastSubmissionTime: 0, lastHttpStatus: 0 };
  constructor(private options: { store: IndexNowStore; key: string; enabled: boolean; fetch?: typeof fetch; request?: (send: () => Promise<Response>) => Promise<Response>; circuitStatus?: () => unknown; log?: (status: number, count: number, error?: string) => void }) {}
  start() {
    if (this.interval || !this.options.enabled) return;
    this.interval = setInterval(() => { void this.flush(); }, 15000);
    this.interval.unref?.(); this.schedule();
  }
  stop() { clearTimeout(this.timer); clearInterval(this.interval); this.timer = undefined; this.interval = undefined; }
  beginBatch() {
    this.activeBatches++;
    let active = true;
    return () => { if (!active) return; active = false; this.activeBatches--; if (this.interval && !this.activeBatches) this.schedule(); };
  }
  enqueue(inputs: string | string[], version?: string) {
    for (const input of Array.isArray(inputs) ? inputs : [inputs]) {
      const url = indexNowUrl(input);
      if (url) this.queue.set(url, { url, version: version || contentVersion([url, new Date().toISOString().slice(0,10)]) });
    }
    if (this.interval) this.schedule();
  }
  private schedule() {
    if (this.timer || this.running) return;
    this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, 1000);
    this.timer.unref?.();
  }
  getStats() { return { ...this.stats, pendingQueueSize: this.queue.size, activeBatches: this.activeBatches, enabled: this.options.enabled, circuitStatus: this.options.circuitStatus?.() || { state: this.running ? 'SUBMITTING' : 'IDLE' } }; }
  flush() {
    if (this.running) return this.running;
    if (this.activeBatches) return Promise.resolve({ success: false, submittedCount: 0, error: 'Filing poll batch is still collecting' });
    if (!this.options.enabled) return Promise.resolve({ success: false, submittedCount: 0, error: 'Server submitter is disabled or key is invalid' });
    // The interval drains leftovers/outages; do not spin a one-second retry loop
    // when persistence is unavailable. Fresh enqueue still gets its normal debounce.
    this.running = this.drain().finally(() => { this.running = undefined; });
    return this.running;
  }
  private async drain(): Promise<{ success: boolean; submittedCount: number; error?: string }> {
    let claims: IndexNowClaim[] = [];
    try {
      const pages = [...this.queue.values()].slice(0,10000);
      if (pages.length) {
        await this.options.store.enqueue(pages);
        for (const page of pages) if (this.queue.get(page.url)?.version === page.version) this.queue.delete(page.url);
      }
      claims = await this.options.store.claim();
      if (!claims.length) return { success: true, submittedCount: 0 };
      const send = () => (this.options.fetch || fetch)('https://api.indexnow.org/indexnow', {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ host: 'bsenexus.in', key: this.options.key, keyLocation: `https://bsenexus.in/${this.options.key}.txt`, urlList: claims.map(c => c.url) }),
        signal: AbortSignal.timeout(7000),
      });
      const response = await (this.options.request ? this.options.request(send) : send());
      const accepted = response.status === 200 || response.status === 202;
      let receiptError: string | undefined;
      try { await this.options.store.complete(claims, response.status); }
      catch { receiptError = 'Receipt persistence unavailable; durable cooldown reservation retained'; }
      this.stats.lastHttpStatus = response.status; this.stats.lastSubmissionTime = Date.now(); this.stats.totalSubmittedUrls += claims.length;
      if (accepted) this.stats.successfulBatches++; else this.stats.failedBatches++;
      this.options.log?.(response.status, claims.length, receiptError);
      return { success: accepted, submittedCount: claims.length, ...(accepted ? {} : { error: `HTTP ${response.status}; at most one retry after the 24-hour cooldown` }) };
    } catch (error: any) {
      this.stats.failedBatches++;
      const status = Number.isInteger(error?.status) ? error.status : 0;
      if (claims.length) { try { await this.options.store.complete(claims, status); } catch {} }
      this.stats.lastHttpStatus = status;
      this.options.log?.(status, claims.length, 'Submission/storage unavailable; ingestion unaffected');
      return { success: false, submittedCount: 0, error: String(error?.message || 'IndexNow unavailable') };
    }
  }
}
