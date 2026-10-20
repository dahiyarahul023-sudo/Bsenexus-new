// Filing identity comes from its BSE scrip code, never its name or symbol.
export function hasExactScripCode(filing: any, targetScrip: unknown): boolean {
  const target = String(targetScrip ?? '').trim();
  if (!/^\d{6}$/.test(target)) return false;
  const codes = [filing?.scrip_cd, filing?.SCRIP_CD, filing?.scripCode]
    .filter(code => code !== undefined && code !== null && String(code).trim() !== '')
    .map(code => String(code).trim());
  return codes.length > 0 && codes.every(code => code === target);
}
