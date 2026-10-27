import { isBseOperatorFiling } from '../../src/shared/scripMatching';
import { DIRECTORY_COMPANIES } from '../../src/config/companyDirectory';
import { resolveStockDetailsSync } from '../utils/stockResolver';
import { contentVersion, type IndexNowPage } from './indexNowQueue';

export function publicFilingVersion(data: any): string {
  return contentVersion([data?.newsId, data?.companyName, data?.subject, data?.details, data?.pdfLink, data?.scrip_cd, data?.bseTime]);
}
/** Called only for confirmed storage changes; queue values never contain PDFs or private data. */
export function storedFilingIndexPages(records: any[]): IndexNowPage[] {
  const companies = new Map<string, string[]>();
  for (const row of records) {
    const code = String(row?.scrip_cd || '').trim();
    if (!row?.newsId || !row?.subject) continue;
    const nseOnlyBse = isBseOperatorFiling(row);
    if (!nseOnlyBse && !/^\d{6}$/.test(code)) continue;
    const symbol = nseOnlyBse ? 'BSE' : DIRECTORY_COMPANIES.find(company => company.scripCode === code)?.symbol || resolveStockDetailsSync(code)?.symbol || code;
    if (!/^[A-Z0-9&.-]{2,20}$/.test(symbol)) continue;
    const url = `https://bsenexus.in/company/${encodeURIComponent(symbol)}`;
    const versions = companies.get(url) || []; versions.push(publicFilingVersion(row)); companies.set(url, versions);
  }
  const pages = [...companies].map(([url, versions]) => ({ url, version: contentVersion([...new Set(versions)].sort()) }));
  if (pages.length) pages.push({ url: 'https://bsenexus.in/announcements', version: contentVersion(pages.map(page => [page.url,page.version]).sort()) });
  return pages;
}
