/**
 * Automatic IndexNow submission for Market Guides ("apne aap index").
 *
 * Standing rule (Oct 2026): every new page the site publishes is submitted
 * to IndexNow automatically — no manual step, no asking.
 *
 * Hygiene (learned Oct 2026 — 99.4K submissions for a 47-URL sitemap):
 * - Submit ONLY on genuine create (a guide slug never submitted before).
 * - Dedupe via a persisted submitted-set on disk; never resubmit.
 * - Guides change rarely, so a boot-time diff is the entire mechanism.
 * - Per-filing/per-announcement spam stays OUT of this path.
 */
import fs from 'fs';
import path from 'path';
import { getMarketGuides } from './marketGuidesService.js';
import { notifySearchEnginesOfNewPages } from './indexNow.js';
import { addLog } from '../database/logDao.js';

const SUBMITTED_FILE = path.join(process.cwd(), 'data', 'indexnow_guides.json');

function loadSubmitted(): Set<string> {
  try {
    if (fs.existsSync(SUBMITTED_FILE)) {
      const raw = fs.readFileSync(SUBMITTED_FILE, 'utf-8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.filter((u: any) => typeof u === 'string'));
      }
    }
  } catch {}
  return new Set();
}

function saveSubmitted(set: Set<string>): void {
  try {
    const dir = path.dirname(SUBMITTED_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SUBMITTED_FILE, JSON.stringify(Array.from(set), null, 2));
  } catch (e: any) {
    console.warn('[GuideIndexNow] Could not persist submitted set:', e?.message || e);
  }
}

/**
 * Enqueue IndexNow submission for guide URLs that have never been submitted.
 * Safe to call on every boot — it is a pure diff, idempotent by design.
 */
export function autoIndexNewGuides(): void {
  try {
    const guides = getMarketGuides();
    const submitted = loadSubmitted();
    const fresh: string[] = [];

    for (const g of guides) {
      const slug = String(g.slug || g.id || '').trim();
      if (!slug) continue;
      const url = `https://bsenexus.in/guides/${encodeURIComponent(slug)}`;
      if (!submitted.has(url)) {
        fresh.push(url);
        submitted.add(url);
      }
    }

    if (fresh.length > 0) {
      notifySearchEnginesOfNewPages(fresh);
      saveSubmitted(submitted);
      addLog(
        'INFO',
        'SEO',
        `IndexNow: auto-queued ${fresh.length} new guide URL(s): ${fresh.join(', ')}`
      ).catch(() => {});
    }
  } catch (e: any) {
    console.warn('[GuideIndexNow] auto-index error:', e?.message || e);
  }
}
