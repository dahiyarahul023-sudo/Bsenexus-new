/** Shared counts describe stored exchange records, never exchange-wide completeness. */
export function filingTimestamp(row: any): number {
  for (const value of [row?.bseTimestamp, row?.timestamp]) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  }
  const parsed = Date.parse(row?.bseTime || '');
  return Number.isFinite(parsed) ? parsed : 0;
}
export function companyFilingStats(rows: any[], now = Date.now()) {
  const unique = new Map<string, any>();
  for (const row of rows) {
    const id = row?.newsId || row?.id;
    // Scheduled calendar rows are not published filings.
    if (id && !String(id).startsWith('bm_') && !String(id).startsWith('hist_')) unique.set(String(id), row);
  }
  const filings = [...unique.values()];
  return { total: filings.length, last30Days: filings.filter(row => {
    const ts = filingTimestamp(row);
    return ts > 0 && ts >= now - 30 * 86_400_000 && ts <= now;
  }).length, asOf: now };
}
export function pageItems<T>(items: T[], page: number, size = 25) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(pages, Math.max(1, Math.trunc(page) || 1));
  return { items: items.slice((current - 1) * size, current * size), current, pages, total: items.length };
}
