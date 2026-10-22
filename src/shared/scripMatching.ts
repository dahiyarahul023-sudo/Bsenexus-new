// NSE-only BSE equity must never inherit Advanced Enzyme's legacy 540025 mapping.
export function isBseOperatorFiling(filing: any): boolean {
  const symbol = String(filing?.symbol || '').trim().toUpperCase();
  const name = String(filing?.companyName || filing?.SLONGNAME || '').trim().replace(/\.$/, '').toUpperCase();
  if (symbol && symbol !== 'BSE') return false;
  if (name && !['BSE LIMITED', 'BSE LTD'].includes(name)) return false;
  if (symbol !== 'BSE' && !['BSE LIMITED', 'BSE LTD'].includes(name)) return false;
  try {
    const url = new URL(filing?.pdfLink || '');
    return url.protocol === 'https:' && url.hostname === 'nsearchives.nseindia.com' && /^\/corporate\/BSE(?:1|_)/i.test(url.pathname);
  } catch { return false; }
}
/** Correct only the demonstrably misassigned legacy NSE BSE records at read time. */
export function projectFilingIdentity<T extends Record<string, any>>(filing: T): T {
  return isBseOperatorFiling(filing) ? { ...filing, scrip_cd: '', SCRIP_CD: '', scripCode: '', symbol: 'BSE', companyName: 'BSE Limited' } : filing;
}
export function matchesCompanyFiling(filing: any, targetScrip: unknown, symbol: string): boolean {
  return symbol.toUpperCase() === 'BSE' ? isBseOperatorFiling(filing) : hasExactScripCode(filing, targetScrip);
}

// Filing identity comes from its BSE scrip code, never its name or symbol.
export function hasExactScripCode(filing: any, targetScrip: unknown): boolean {
  const target = String(targetScrip ?? '').trim();
  if (!/^\d{6}$/.test(target)) return false;
  if (target === '540025' && isBseOperatorFiling(filing)) return false;
  const codes = [filing?.scrip_cd, filing?.SCRIP_CD, filing?.scripCode]
    .filter(code => code !== undefined && code !== null && String(code).trim() !== '')
    .map(code => String(code).trim());
  return codes.length > 0 && codes.every(code => code === target);
}
