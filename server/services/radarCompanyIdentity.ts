import { registerStockEntry, resolveStockDetailsStrict } from '../utils/stockResolver.js';

const pending = new Map<string, Promise<void>>(), attempted = new Map<string, number>();
/** Background-only, bounded Screener lookup. A search hit alone never establishes a BSE identity. */
export async function refreshRadarCompanyIdentity(scrip: string): Promise<void> {
  if (!/^\d{6}$/.test(scrip) || resolveStockDetailsStrict(scrip)) return;
  if (pending.has(scrip)) return pending.get(scrip);
  if ((attempted.get(scrip) || 0) > Date.now() - 10 * 60_000 || pending.size >= 4) return;
  attempted.set(scrip, Date.now());
  if (attempted.size > 500) attempted.delete(attempted.keys().next().value!);
  const work = (async () => {
    try {
      const response = await fetch(`https://www.screener.in/api/company/search/?q=${scrip}`, { signal: AbortSignal.timeout(4000), redirect: 'error' });
      if (!response.ok) return;
      const candidates = await response.json();
      if (!Array.isArray(candidates)) return;
      for (const c of candidates.slice(0, 2)) {
        if (typeof c.name !== 'string' || !/[a-z]/i.test(c.name) || c.name.length > 160 || typeof c.url !== 'string') continue;
        const path = c.url.match(/^\/company\/([A-Z0-9&._-]{1,30})\/(?:consolidated\/)?$/i);
        if (!path) continue;
        const page = await fetch(`https://www.screener.in/company/${encodeURIComponent(path[1])}/`, { signal: AbortSignal.timeout(4000), redirect: 'error' });
        if (!page.ok) continue;
        const html = await page.text();
        if (html.length > 2_000_000) continue;
        // Require the exchange link on the company page to agree with the requested code.
        const exchangeCodes = [...html.matchAll(/https:\/\/(?:www\.)?bseindia\.com\/stock-share-price\/[^"'<>\s]*?\/(\d{6})(?:\/|["'])/gi)].map(m => m[1]);
        if (!exchangeCodes.includes(scrip)) continue;
        registerStockEntry({ symbol: path[1].toUpperCase(), scripCode: scrip, name: c.name, nameKeywords: [c.name] }, false);
        return;
      }
    } catch { /* Unverified identities stay pending; they are never fabricated. */ }
    finally { pending.delete(scrip); }
  })();
  pending.set(scrip, work); return work;
}
