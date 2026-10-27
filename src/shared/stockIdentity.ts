export interface StockMasterEntry { symbol: string; scripCode: string; name: string; nameKeywords: string[]; sector?: string }

// Exchange identities checked 21 Oct 2026. See the checklist change record for sources.
export const VERIFIED_STOCK_IDENTITIES: StockMasterEntry[] = [
  // BSE equity is NSE-only; 540025 belongs to Advanced Enzyme, not the exchange.
  { symbol: 'BSE', scripCode: '', name: 'BSE Limited', nameKeywords: ['BSE LIMITED', 'BSE LTD'] },
  { symbol: 'NSE', scripCode: '544937', name: 'National Stock Exchange of India Limited', nameKeywords: ['NATIONAL STOCK EXCHANGE OF INDIA', 'NSE LIMITED'] },
  { symbol: 'ADVENZYMES', scripCode: '540025', name: 'Advanced Enzyme Technologies Ltd', nameKeywords: ['ADVANCED ENZYME'] },
  { symbol: 'INDUSINDBK', scripCode: '532187', name: 'IndusInd Bank Ltd', nameKeywords: ['INDUSIND BANK'] },
  { symbol: 'J&KBANK', scripCode: '532209', name: 'Jammu and Kashmir Bank Ltd', nameKeywords: ['JAMMU AND KASHMIR BANK', 'J&K BANK', 'JKBANK'] },
  { symbol: 'ETERNAL', scripCode: '543320', name: 'Eternal Limited', nameKeywords: ['ETERNAL', 'ZOMATO', 'ZOMATO LTD', 'ZOMATO LIMITED'] },
];
export function verifiedStockIdentity(entry: StockMasterEntry): StockMasterEntry | null {
  const symbol = String(entry.symbol || '').trim().toUpperCase();
  const code = String(entry.scripCode || '').trim();
  const named = VERIFIED_STOCK_IDENTITIES.find(e => e.symbol === symbol || (symbol === 'ZOMATO' && e.symbol === 'ETERNAL'));
  // A poisoned legacy cache must never reassign a known ticker to another security.
  if (named && code && code !== named.scripCode) return null;
  const verified = named || VERIFIED_STOCK_IDENTITIES.find(e => code && e.scripCode === code);
  return verified ? { ...entry, ...verified, nameKeywords: [...verified.nameKeywords] } : entry;
}
export function verifiedSymbolAliases(symbol: string): string[] {
  return symbol === 'ETERNAL' ? ['ZOMATO'] : symbol === 'J&KBANK' ? ['JKBANK'] : [];
}

export const VERIFIED_STOCK_BY_SYMBOL = Object.fromEntries(VERIFIED_STOCK_IDENTITIES.map(entry => [entry.symbol, entry]));
