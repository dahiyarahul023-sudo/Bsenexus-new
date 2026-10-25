import { customFetch } from '../api';

type Job = { id: string; scripCode: string; years: number; state: string; processed: number; unverifiedDocuments?: number; error?: string };
export function archivePause(signal: AbortSignal, ms = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
}
export async function waitForResultArchive(job: Job, signal: AbortSignal, progress: (job: Job) => void,
  request = customFetch, pause = archivePause) {
  const deadline = Date.now() + 11 * 60_000;
  while (job.state === 'running') {
    if (Date.now() > deadline) throw new Error('Archive still pending. Retry to check saved records.');
    await pause(signal);
    const query = new URLSearchParams({ years: String(job.years), id: job.id });
    const response = await request(`/api/stocks/${encodeURIComponent(job.scripCode)}/fetch-deep-history?${query}`, { signal });
    const data = await response.json();
    if (!response.ok || !data.job) throw new Error(data.error || 'Archive status unavailable; retry sync.');
    job = data.job; progress(job);
  }
  if (job.state !== 'complete') throw new Error(job.error || 'Archive incomplete. Saved filings remain available.');
  return job;
}
export async function watchResultHistory(identity: { symbol: string; scripCode: string; companyName?: string }, signal: AbortSignal,
  update: (rows: any[], sync: Job | null) => void, autoSync = true, request = customFetch, pause = archivePause) {
  const query = new URLSearchParams({ ...identity, companyName: identity.companyName || '' });
  const deadline = Date.now() + 11 * 60_000;
  let first = true;
  let receiptId = '';
  while (true) {
    query.set('autoSync', first && autoSync ? '1' : '0'); first = false;
    const response = await request(`/api/stock-results-history?${query}`, { signal });
    const data = await response.json();
    if (!response.ok || !data.success || !Array.isArray(data.history)) throw new Error(data.error || 'Result history unavailable. Please retry.');
    if (signal.aborted) return;
    update(data.history, data.historySync || null);
    if (data.historyWarning) throw new Error(data.historyWarning);
    if (!autoSync) return;
    if (receiptId && data.historySync?.id !== receiptId) throw new Error('Archive status unavailable on this instance. Saved results are shown; retry sync.');
    receiptId = data.historySync?.id || '';
    if (data.historySync?.state === 'failed') throw new Error(data.historySync.error || 'BSE archive unavailable. Saved results are shown.');
    if (data.historySync?.state !== 'running') return;
    if (Date.now() > deadline) throw new Error('Archive still pending. Retry to check saved records.');
    await pause(signal);
  }
}
