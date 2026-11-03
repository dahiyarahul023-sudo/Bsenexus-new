const aliases: Record<string, readonly string[]> = {
  SBIN: ['SBI', 'State Bank of India'],
  SOLARINDS: ['Solar Industries', 'Solar Industries India'],
  'J&KBANK': ['J&K Bank', 'Jammu and Kashmir Bank'],
};
const words = (value: string) => ` ${value.toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim()} `;
/** Issuer identity, not sector keywords. Only legal suffixes are removed from a company name. */
export function matchStockInText(text: string, symbol: string, companyName = ''): boolean {
  const ticker=symbol.trim();
  if(!ticker)return false;
  const escaped=ticker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(!/^\d+$/.test(ticker) && new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`,'i').test(text))return true;
  const name=companyName.replace(/(?:\s|,)+(?:limited|ltd\.?|plc)\.?$/i,'').trim();
  const candidates=[name,...(aliases[ticker.toUpperCase()] || [])].filter(n=>n.length>=3 && /[a-z]/i.test(n));
  const haystack=words(text);
  return candidates.some(n=>haystack.includes(words(n)));
}
