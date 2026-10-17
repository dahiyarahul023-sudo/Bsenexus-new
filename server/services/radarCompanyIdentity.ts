import { registerStockEntry, resolveStockDetailsStrict } from '../utils/stockResolver.js';
import type { RadarCompany, RadarSource } from '../../src/shared/impactRadar.js';
const filingNames = new Map<string, RadarCompany>();

export const radarCompanyKey = (name: string) => name.toUpperCase().replace(/\b(?:LIMITED|LTD)\.?$/i, '').replace(/&/g, 'AND').replace(/[^A-Z0-9]/g, '');
/** Names already attached to an exchange filing do not require a second website lookup. */
export function radarCompanyFromFiling(f: { scrip_cd?: unknown; SCRIP_CD?: unknown; companyName?: unknown; SLONGNAME?: unknown; subject?: unknown; pdfLink?: unknown }): RadarCompany | null {
  const code = String(f.scrip_cd || f.SCRIP_CD || '');
  if (!/^\d{6}$/.test(code) || typeof f.pdfLink !== 'string') return null;
  try { const u = new URL(f.pdfLink); if (u.protocol !== 'https:' || u.username || u.password || u.port || !/(^|\.)(bseindia|nseindia)\.com$/i.test(u.hostname)) return null; } catch { return null; }
  const prefix = typeof f.subject === 'string' ? f.subject.match(/^(.{3,160}?)\s+-\s+(\d{6})\s+-\s/) : null;
  if (prefix && prefix[2] !== code) return null;
  const candidate = [f.companyName, f.SLONGNAME, prefix?.[1]].find(n => typeof n === 'string' && /[a-z]/i.test(n) && n.length <= 160 && !/[<>]/.test(n));
  const known = resolveStockDetailsStrict(code);
  if (typeof candidate !== 'string') return known || filingNames.get(code) || null;
  const company = { scripCode: code, name: candidate.trim(), symbol: known?.symbol || code };
  if (filingNames.size >= 1000 && !filingNames.has(code)) filingNames.delete(filingNames.keys().next().value!);
  filingNames.set(code, company); return company;
}
export function resolveRadarCompany(c: RadarCompany, title: string, source: RadarSource): RadarCompany {
  const fromSource = source.kind === 'disclosure' ? radarCompanyFromFiling({scrip_cd:c.scripCode,subject:title,pdfLink:source.url,companyName:/[a-z]/i.test(c.name)?c.name:undefined}) : null;
  if (fromSource) return { ...fromSource, symbol: /^\d{6}$/.test(fromSource.symbol) && /[a-z]/i.test(c.symbol) ? c.symbol : fromSource.symbol };
  return resolveStockDetailsStrict(c.scripCode) || c;
}

const pending = new Map<string, Promise<void>>(), attempted = new Map<string, number>();
/** Background-only, bounded Screener lookup. A search hit alone never establishes a BSE identity. */
export async function refreshRadarCompanyIdentity(scrip: string): Promise<void> {
  if (!/^\d{6}$/.test(scrip) || /[a-z]/i.test(resolveStockDetailsStrict(scrip)?.symbol || '')) return;
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
