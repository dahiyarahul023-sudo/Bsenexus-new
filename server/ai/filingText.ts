export const FILING_CATEGORIES = ['RESULTS','BOARD_MEETING','DIVIDEND','BONUS','SPLIT','BUYBACK','ORDER_WIN','ACQUISITION','CREDIT_RATING','CONFERENCE_CALL','ANNUAL_REPORT','OTHER'] as const;
export function plainFilingText(value: unknown, max = 4000): string {
  return String(value ?? '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39|#x27);/gi, entity => ({'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",'&#x27;':"'"}[entity.toLowerCase()] || ' '))
    .replace(/<[^>]*>/g, ' ').replace(/[\x00-\x08\x0e-\x1f]/g, '').replace(/''(?=[A-Za-z])/g, "'").trim().slice(0,max);
}
export function filingCategories(ann: any): string[] {
  const category = String(ann.category || ann.category_name || '').toUpperCase().replace(/[\s/-]+/g,'_');
  const text = plainFilingText([ann.subject,ann.NEWSSUB,ann.details].filter(Boolean).join(' '),10000);
  const tags = new Set<string>();
  if ((FILING_CATEGORIES as readonly string[]).includes(category) && category !== 'OTHER') tags.add(category);
  if (/board meeting.*(?:intimation|schedule)|(?:intimation|schedule).*board meeting/i.test(text)) tags.add('BOARD_MEETING');
  else if (/financial results|quarterly results|unaudited results|audited results/i.test(text)) tags.add('RESULTS');
  for (const [tag,pattern] of [
    ['DIVIDEND',/\bdividend\b/i],['BONUS',/\bbonus\b/i],['SPLIT',/stock split|sub.?division/i],['BUYBACK',/buy.?back/i],
    ['ORDER_WIN',/order win|contract award|award of contract|receipt of order/i],['ACQUISITION',/\bacquisition\b|\bmerger\b/i],
    ['CREDIT_RATING',/credit rating|rating (?:upgrade|downgrade|reaffirm)/i],['CONFERENCE_CALL',/conference call|earnings call|investor meet/i],['ANNUAL_REPORT',/annual report/i],
  ] as const) if (pattern.test(text)) tags.add(tag);
  return tags.size ? [...tags] : ['OTHER'];
}
export function summaryText(value: unknown, detail: 'brief' | 'full') {
  const max = detail === 'full' ? 4000 : 600, text = plainFilingText(value,max+1);
  return {summary:text.slice(0,max),summaryTruncated:text.length>max || /(?:\.{3,}|…)\s*$/.test(text)};
}
