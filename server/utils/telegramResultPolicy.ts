export interface ResultFiling { company: string; subject: string; details: string; category: string; scripCode?: string; }

/** A result period is evidence from the filing, never inferred from today's date. */
export function telegramResultIdentity(filing: ResultFiling): string | null {
  const text = (filing.subject + ' ' + filing.details).replace(/\s+/g, ' ');
  if (filing.category !== 'RESULTS' || !/financial\s+(?:results|statements)|(?:un)?audited\s+results/i.test(text)) return null;
  if (/intimation|to\s+(?:consider|approve)|will\s+be\s+held|newspaper|publication|transcript|investor\s+presentation|earnings\s+call|trading\s+window/i.test(text)) return null;
  const code = filing.scripCode?.trim() || /\b(\d{6})\b/.exec(filing.subject)?.[1];
  if (!code || !/^\d{5,6}$/.test(code)) return null;
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const tail = /(?:period|quarter|year|half[ -]?year)\s+ended\s*(?:on\s*)?(.{0,65})/i.exec(text)?.[1];
  if (!tail) return null;
  let year = 0, month = 0, day = 0;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(tail);
  const numeric = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/.exec(tail);
  const named = /^(?:(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]+)|([a-z]+)[\s-]+(\d{1,2})(?:st|nd|rd|th)?)[,\s-]+(\d{4})/i.exec(tail);
  if (iso) [, year, month, day] = iso.map(Number);
  else if (numeric) [, day, month, year] = numeric.map(Number);
  else if (named) {
    day = Number(named[1] || named[4]); year = Number(named[5]);
    const name = (named[2] || named[3]).toLowerCase();
    month = months.findIndex(value => value === name || value.slice(0, 3) === name) + 1;
  }
  if (year < 2000 || year > 2100 || ![3,6,9,12].includes(month) || day !== new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  return 'results:' + code + ':' + year + '-' + String(month).padStart(2, '0') + '-' + day;
}

export function isValidTelegramResultSummary(text: string): boolean {
  if (!text || text.length < 100) return false;
  if (/\[(?:current|yoy|qoq|pending|[+\-]?x)|\bX(?:\.X)?\s*(?:%|bps)|please\s+(?:provide|upload|paste)|not\s+(?:attached|provided)|no\s+(?:financial\s+)?data|not available in filing|Fast Filing Summary|Heuristic extraction/i.test(text)) return false;
  const clean = text.replace(/\*\*|<[^>]*>/g, '');
  // A numerical revenue/income and net-profit/PAT metric are the minimum useful result.
  return /(?:revenue|total\s+income|net\s+sales)[^\n]{0,60}[₹\d][\d,]+(?:\.\d+)?/i.test(clean) &&
    /(?:PAT|net\s+profit|profit\s+after\s+tax)[^\n]{0,60}[₹\d][\d,]+(?:\.\d+)?/i.test(clean);
}
