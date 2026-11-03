import { isIntimationOrNoticeFiling } from '../shared/resultFiling';
/**
 * Utility to clean repetitive BSE announcement subject noise.
 * Strips duplicate company name, scrip code, boilerplate "Announcement under Regulation 30 (LODR)-" prefixes,
 * and extracts standard regulatory tag badges for ultra-clean terminal-style reading.
 */

function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface CleanSubjectResult {
  headline: string;
  humanTitle: string;
  regulation?: string;
  badgeTone?: 'sky' | 'emerald' | 'violet' | 'amber' | 'rose' | 'slate';
  isInvestorCall?: boolean;
  original: string;
}

export function detectHumanTitle(text: string, category?: string): string {
  const t = text.toLowerCase();
  
  // 1. Investor Call, Analyst Meet, Con Call (highest priority to surface substantive meeting nature)
  if (
    t.includes('analyst') ||
    t.includes('investor meet') ||
    t.includes('investors meet') ||
    t.includes('investor call') ||
    t.includes('institutional investor') ||
    t.includes('concall') ||
    t.includes('con call') ||
    t.includes('con. call') ||
    t.includes('conference call') ||
    t.includes('earnings call') ||
    t.includes('audio recording') ||
    t.includes('transcript') ||
    category === 'CONFERENCE_CALL'
  ) {
    if (t.includes('audio recording')) return 'Earnings call audio';
    if (t.includes('transcript')) return 'Earnings call transcript';
    if (t.includes('presentation') || t.includes('deck')) return 'Investor presentation';
    return 'Analysts / Investor Meet / Con. Call';
  }

  // 2. Press / Media Releases
  if (t.includes('press release') || t.includes('media release') || t.includes('media statement')) return 'Press release';

  if (isIntimationOrNoticeFiling(text) && /board|meeting|consider|regulation\s*29/i.test(text)) return 'Board meeting intimation';

  // 3. Financial Results
  if (
    t.includes('financial result') ||
    t.includes('audited standalone') ||
    t.includes('audited consolidated') ||
    t.includes('financials') ||
    t.includes('quarterly result') ||
    category === 'RESULTS'
  ) {
    return 'Financial results';
  }

  // 4. Board Meetings (Intimations and Outcomes)
  if (
    t.includes('board meeting intimation') ||
    t.includes('intimation of board meeting') ||
    t.includes('prior intimation of board meeting')
  ) {
    return 'Board meeting intimation';
  }
  if (t.includes('outcome of board') || t.includes('board meeting outcome') || t.includes('board announcement')) {
    return 'Board announcement';
  }
  if (t.includes('board meeting')) return 'Board meeting';

  // 5. Quarterly Updates
  if (
    t.includes('quarterly update') ||
    t.includes('information update for the quarter') ||
    t.includes('operational update') ||
    t.includes('business update')
  ) {
    return 'Quarterly business update';
  }

  // 6. Regulatory Compliances & Share Certificates
  if (
    /reg\.?\s*74\s*\(5\)/i.test(t) ||
    /regulation\s*74\s*\(5\)/i.test(t) ||
    (t.includes('depositories and participants') && t.includes('74'))
  ) {
    return 'Certificate under SEBI (DP) Reg 74(5)';
  }
  if (
    t.includes('loss of share') ||
    t.includes('duplicate share') ||
    /reg\.?\s*39\s*\(3\)/i.test(t) ||
    /regulation\s*39\s*\(3\)/i.test(t)
  ) {
    return 'Share certificate update';
  }
  if (t.includes('reg 40(9)') || t.includes('reg 7(3)')) return 'SEBI compliance certificate';

  // 7. Orders & Commercial Contracts
  if (t.includes('order') || t.includes('contract') || t.includes('bagged') || t.includes('awarded')) return 'Commercial order';

  // 8. Leadership & Key Personnel
  if (t.includes('resignation') || t.includes('appointment') || t.includes('kmp') || t.includes('director')) return 'Leadership update';

  // 9. Dividends & Corporate Actions
  if (t.includes('dividend') || t.includes('bonus') || t.includes('split') || t.includes('rights issue') || t.includes('buyback')) return 'Corporate action';

  // 10. M&A / Joint Ventures
  if (t.includes('acquisition') || t.includes('takeover') || t.includes('amalgamation') || t.includes('merger') || t.includes('joint venture')) return 'Strategic acquisition';

  // 11. Credit Ratings
  if (t.includes('credit rating')) return 'Credit rating update';

  // 12. Shareholder Meetings
  if (t.includes('agm') || t.includes('egm') || t.includes('postal ballot') || t.includes('general meeting')) return 'Shareholder meeting';

  // 13. Trading Window
  if (t.includes('trading window')) return 'Trading window notice';

  // 14. Clarifications
  if (t.includes('clarification') || t.includes('news confirmation')) return 'Exchange clarification';

  return 'Corporate announcement';
}

export function cleanBseSubject(
  rawSubject: string | undefined | null,
  companyName?: string,
  scripCode?: string | number
): CleanSubjectResult {
  if (!rawSubject) {
    return { headline: 'Corporate Announcement', humanTitle: 'Corporate announcement', original: '' };
  }

  let text = String(rawSubject).trim();
  const original = text;

  // Sanitize common corrupted HTML entities and quotes in BSE strings
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/''+/g, "'")
    .replace(/([a-zA-Z])"([a-zA-Z])/g, "$1'$2") // Fixes e.g. "Scrutinizer"s" -> "Scrutinizer's"
    .replace(/""+/g, '"')
    .trim();

  // 1. Remove Company Name prefix if explicitly repeated at start
  // e.g. "Godrej Properties Ltd - 533150 - Announcement under..."
  if (companyName) {
    const cleanComp = companyName.replace(/\s+L(?:imi)?t(?:e)?d\.?$/i, '').trim();
    if (cleanComp.length > 2) {
      const compRegex = new RegExp(`^${escapeRegex(cleanComp)}(?:\\s+Limited|\\s+Ltd\\.?)?\\s*[-–—:]?\\s*`, 'i');
      text = text.replace(compRegex, '');
    }
  }

  // Also remove generic [Company Name - Scrip -] pattern if at start
  text = text.replace(/^[A-Za-z0-9\s&.,'()]{3,45}\s*[-–—]\s*\d{6}\s*[-–—:]\s*/, '');

  // 2. Remove Scrip code prefix if present: e.g. "533150 - "
  if (scripCode) {
    const scripRegex = new RegExp(`^${scripCode}\\s*[-–—:]?\\s*`, 'i');
    text = text.replace(scripRegex, '');
  }
  text = text.replace(/^\d{6}\s*[-–—:]\s*/, '');

  // 3. Extract Regulation info cleanly
  let regulation: string | undefined = undefined;
  if (/Regulation\s*30/i.test(text) || /Reg\.?\s*30/i.test(text)) {
    regulation = 'Reg 30 (LODR)';
  } else if (/Regulation\s*(\d+)/i.test(text)) {
    const match = text.match(/Regulation\s*(\d+)(?:\s*\(([^)]+)\))?/i);
    if (match) {
      regulation = `Reg ${match[1]}${match[2] ? ` (${match[2]})` : ''}`;
    }
  } else if (/Reg\.?\s*74\(5\)/i.test(text)) {
    regulation = 'Reg 74(5)';
  } else if (/Reg\.?\s*39\(3\)/i.test(text)) {
    regulation = 'Reg 39(3)';
  } else if (/Outcome\s+of\s+Board\s+Meeting/i.test(text)) {
    regulation = 'Board Outcome';
  } else if (/Financial\s+Results/i.test(text)) {
    regulation = 'Financials';
  }

  // 4. Strip boilerplate repetitive prefixes
  text = text.replace(/^(?:Announcement\s+under\s+)?Regulation\s+\d+\s*(?:\([^)]+\))?\s*[-–—:]\s*/i, '');
  text = text.replace(/^(?:Announcement\s+under\s+)?Regulation\s+\d+\s+of\s+SEBI\s*\([^)]+\)\s*Regulations?,?\s*\d{4}\s*[-–—:]\s*/i, '');
  text = text.replace(/^SEBI\s*\([^)]+\)\s*Regulations?,?\s*\d{4}\s*[-–—:]\s*/i, '');
  text = text.replace(/^Compliances\s*[-–—:]\s*(?:Certificate\s+under\s+(?:Reg\.?|Regulation)\s*\d+(?:\(\d+\))?\s*[-–—:]\s*)?/i, '');
  text = text.replace(/^Corporate\s+Announcement\s*[-–—:]\s*/i, '');
  text = text.replace(/^Outcome\s+of\s+Board\s+Meeting\s*[-–—:]\s*/i, '');
  text = text.replace(/^Board\s+Meeting\s+Intimation\s+for\s+/i, 'Board Meeting Intimation — ');

  // Clean leading and trailing punctuation / whitespace
  text = text.replace(/^[-–—:\s]+/, '').replace(/[-–—:\s]+$/, '').trim();

  // If text became empty, fallback gracefully
  if (!text) {
    text = original.replace(/^[A-Za-z0-9\s&.,'()]{3,45}\s*[-–—]\s*/, '').trim() || original;
  }

  const humanTitle = detectHumanTitle(original);

  // Determine appropriate visual badge tone and investor call flag
  let badgeTone: 'sky' | 'emerald' | 'violet' | 'amber' | 'rose' | 'slate' = 'slate';
  let isInvestorCall = false;

  if (
    humanTitle.includes('Investor') ||
    humanTitle.includes('Earnings call') ||
    humanTitle.includes('Con. Call')
  ) {
    badgeTone = 'sky';
    isInvestorCall = true;
  } else if (humanTitle.includes('Financial results')) {
    badgeTone = 'emerald';
  } else if (humanTitle.includes('Press release')) {
    badgeTone = 'violet';
  } else if (humanTitle.includes('Board')) {
    badgeTone = 'amber';
  } else if (humanTitle.includes('Commercial order')) {
    badgeTone = 'emerald';
  } else if (humanTitle.includes('Corporate action')) {
    badgeTone = 'violet';
  } else if (humanTitle.includes('Certificate')) {
    badgeTone = 'slate';
  }

  return {
    headline: text,
    humanTitle,
    regulation,
    badgeTone,
    isInvestorCall,
    original
  };
}
