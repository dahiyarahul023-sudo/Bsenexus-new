/** Industry membership only; identity/name/code always come from the stock catalogue. */
const INDUSTRIES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['Private sector banks', ['FEDERALBNK', 'RBLBANK', 'IDFCFIRSTB', 'BANDHANBNK', 'HDFCBANK', 'ICICIBANK', 'AXISBANK', 'KOTAKBANK', 'INDUSINDBK', 'YESBANK']],
  ['Public sector banks', ['SBIN', 'CANBK', 'BANKBARODA', 'PNB', 'UNIONBANK', 'INDIANB', 'IOB', 'MAHABANK', 'UCOBANK', 'CENTRALBK']],
  ['Two & three wheelers', ['BAJAJ-AUTO', 'TVSMOTOR', 'HEROMOTOCO', 'EICHERMOT']],
  ['Passenger & commercial vehicles', ['MARUTI', 'M&M', 'TATAMOTORS', 'ASHOKLEY']],
  ['IT services', ['TCS', 'INFY', 'HCLTECH', 'WIPRO', 'TECHM', 'LTIM', 'PERSISTENT', 'COFORGE', 'MPHASIS']],
  ['Pharmaceuticals', ['SUNPHARMA', 'CIPLA', 'DRREDDY', 'LUPIN', 'AUROPHARMA', 'ZYDUSLIFE', 'ALKEM', 'TORNTPHARM']],
  ['Cement', ['ULTRACEMCO', 'AMBUJACEM', 'ACC', 'SHREECEM', 'DALBHARAT', 'JKCEMENT']],
  ['Paints', ['ASIANPAINT', 'BERGEPAINT', 'KANSAINER', 'AKZOINDIA']],
  ['Steel', ['TATASTEEL', 'JSWSTEEL', 'SAIL', 'JINDALSTEL']],
  ['Power generation', ['NTPC', 'TATAPOWER', 'ADANIPOWER', 'JSWENERGY', 'TORNTPOWER', 'NHPC', 'SJVN', 'GIPCL']],
  ['Oil & gas exploration', ['ONGC', 'OIL']],
  ['Oil refining & marketing', ['IOC', 'BPCL', 'HINDPETRO', 'MRPL', 'CHENNPETRO']],
  ['Consumer products', ['HINDUNILVR', 'GODREJCP', 'DABUR', 'MARICO', 'COLPAL']],
  ['Non-bank lenders', ['BAJFINANCE', 'CHOLAFIN', 'SHRIRAMFIN', 'M&MFIN', 'LTF']],
  ['Life insurance', ['LICI', 'SBILIFE', 'HDFCLIFE', 'ICICIPRULI']],
  ['Real estate development', ['DLF', 'GODREJPROP', 'OBEROIRLTY', 'PRESTIGE', 'PHOENIXLTD']],
];

export interface PeerStock { symbol: string; scripCode: string; name: string; sector?: string; }
const key = (value: string) => value.trim().toUpperCase().replace(/[\s-]/g, '');
const sectorKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

/** No inferred name matching, broad financial-sector grouping or additional upstream fetch. */
export function selectCompanyPeers(entries: readonly PeerStock[], symbol: string, scripCode: string) {
  const target = entries.find(entry => scripCode ? entry.scripCode === scripCode : key(entry.symbol) === key(symbol));
  if (!target) return { industry: '', stocks: [] as PeerStock[] };
  const group = INDUSTRIES.find(([, members]) => members.some(member => key(member) === key(target.symbol)));
  const industry = group?.[0] || target.sector?.trim() || '';
  if (!industry || /^(equities|other|unknown|financial services|financials)$/i.test(industry)) return { industry: '', stocks: [] as PeerStock[] };
  const seen = new Set<string>();
  const candidates = entries.filter(entry => {
    if (!entry.name || !/^\d{6}$/.test(entry.scripCode) || entry.scripCode === target.scripCode || key(entry.symbol) === key(target.symbol)) return false;
    const matches = group
      ? group[1].some(member => key(member) === key(entry.symbol))
      : sectorKey(entry.sector || '') === sectorKey(industry);
    if (!matches || seen.has(entry.scripCode)) return false;
    seen.add(entry.scripCode);
    return true;
  });
  candidates.sort((a, b) => group
    ? group[1].findIndex(s => key(s) === key(a.symbol)) - group[1].findIndex(s => key(s) === key(b.symbol))
    : a.name.localeCompare(b.name));
  return { industry, stocks: candidates.slice(0, 4).map(({symbol, scripCode, name}) => ({symbol, scripCode, name})) };
}
