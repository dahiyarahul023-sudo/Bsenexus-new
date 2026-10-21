import { addLog } from '../database/logDao.js';
import { isSupabaseConfigured } from '../database/supabase';
import { indexNowStore } from '../database/indexNowDao';
import { IndexNowQueue, contentVersion } from './indexNowQueue';
import { INDEXNOW_KEY, INDEXNOW_SUBMITTER } from './indexNowConfig';
import { DIRECTORY_COMPANIES, directoryDescription } from '../../src/config/companyDirectory';
import { circuitRegistry } from '../utils/circuitBreaker';
export { INDEXNOW_KEY, INDEXNOW_HOST, INDEXNOW_KEY_LOCATION, INDEXNOW_SUBMITTER } from './indexNowConfig';
export const indexNowCircuit = circuitRegistry.getOrCreate('INDEXNOW_API', { failureThreshold: 3, timeoutMs: 8000, resetTimeoutMs: 60000 });

export const indexNowQueue = new IndexNowQueue({
  store: indexNowStore, key: INDEXNOW_KEY,
  enabled: Boolean(INDEXNOW_KEY && INDEXNOW_SUBMITTER === 'server' && isSupabaseConfigured() && process.env.NODE_ENV !== 'test'),
  circuitStatus: () => indexNowCircuit.getStatus(),
  request: send => indexNowCircuit.execute(async () => {
    const response = await send();
    if (response.status !== 200 && response.status !== 202) throw Object.assign(new Error(`IndexNow HTTP ${response.status}`), { status: response.status });
    return response;
  }),
  log(status, count, error) {
    const message = `[IndexNow] HTTP ${status} · ${count} URL(s)${error ? ' · ' + error : ''}`;
    console.info(message);
    void addLog(status === 200 || status === 202 ? 'INFO' : 'WARN', 'SEO', message).catch(() => {});
  },
});

export function notifySearchEnginesOfNewPages(urls: string | string[], version?: string): void {
  indexNowQueue.enqueue(urls, version);
}

export function startIndexNow(): void {
  indexNowQueue.start();
  indexNowQueue.enqueue('https://bsenexus.in/companies', contentVersion([DIRECTORY_COMPANIES, directoryDescription()]));
  const nexus = DIRECTORY_COMPANIES.find(company => company.symbol === 'NXST');
  if (nexus) indexNowQueue.enqueue('https://bsenexus.in/company/NXST', contentVersion(nexus));
}
