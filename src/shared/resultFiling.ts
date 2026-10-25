const ancillaryResultTitle = /investor[ /-]*(?:presentation|meet)|analyst[ /-]*(?:presentation|meet)|press[ -]*release|newspaper|transcript|audio[ -]*recording|voting[ -]*results?|scrutinizer|postal[ -]*ballot/i;

export function isPureResultOutcomeFiling(subject: string = '', details: string = ''): boolean {
  const combined = `${subject || ''} ${details || ''}`.trim();
  if (!combined) return false;
  const lower = combined.toLowerCase();
  // Reproductions and investor communications do not establish the release clock.
  if (ancillaryResultTitle.test(subject)) return false;

  // 1. Strictly reject non-financial result filings (Regulation 30 intimations, investor meets, analyst calls, press releases, etc.)
  const isCorporateNoticeOrIntimation = 
    /analyst\s*\/\s*investor\s*meet|investor\s*meet|analyst\s*meet|institutional\s*investor|conference\s*call|earnings\s*call/i.test(lower) ||
    /investor\s*presentation|analyst\s*presentation|corporate\s*presentation|audio\s*recording|transcript\s*of|press\s*release/i.test(lower) ||
    /newspaper\s*publication|loss\s*of\s*share|duplicate\s*share|credit\s*rating|change\s*in\s*(?:director|kmp|management|auditor)|resignation|appointment/i.test(lower) ||
    /closure\s*of\s*trading\s*window|trading\s*window\s*closure|prior\s*intimation|intimation\s*of\s*board\s*meeting|notice\s*of\s*board\s*meeting|meeting\s*scheduled\s*to\s*be\s*held|to\s*consider\s*and\s*approve/i.test(lower) ||
    /postal\s*ballot|scrutinizer|voting\s*results|record\s*date\s*intimation|allotment\s*of\s*shares|reconstitution/i.test(lower);

  if (isIntimationOrNoticeFiling(subject, details)) return false;

  if (isCorporateNoticeOrIntimation) {
    const hasStrictReg33 = /\b(?:regulation 33|reg\s*33|reg\.\s*33|lodr\s*33)\b/i.test(lower);
    const hasApprovedResults = /\b(?:considered and approved the (?:un-?audited|audited|financial)|approved the (?:un-?audited|audited|financial) results)\b/i.test(lower);
    if (!hasStrictReg33 && !hasApprovedResults) {
      return false;
    }
  }

  // 2. Definitive Regulation 33 Financial Results Outcome Matches
  if (/\b(?:regulation 33|reg\s*33|reg\.\s*33|lodr\s*33)\b/i.test(lower)) {
    return true;
  }

  // 3. Exact and simple Financial Results / Results phrases (e.g. Shriram Finance "Financial Results", "Results", "Results/Dividend")
  if (
    /^(?:financial results?|results?|results\s*\/\s*dividend|financial results\s*\/\s*dividend)[\.\s\-:]*$/i.test(combined.trim()) ||
    /\b(?:financial results?|financial result|un-?audited financial results?|audited financial results?|statement of (?:standalone|consolidated|financial) results)\b/i.test(lower) ||
    /\b(?:financial results \(standalone|financial results - standalone|financial results \(consolidated|financial results - consolidated)\b/i.test(lower) ||
    /\b(?:standalone and consolidated financial results|financial results for the (?:quarter|half year|nine months|year ended))\b/i.test(lower) ||
    /\b(?:considered and approved (?:the )?(?:un-?audited|audited|financial)|approved (?:the )?(?:un-?audited|audited|financial) results|approval of (?:un-?audited|audited|financial) results)\b/i.test(lower)
  ) {
    return true;
  }

  // BSE companies also submit terse result titles without the word financial.
  if (/\bresults?\s+for\s+(?:the\s+)?(?:quarter|half[ -]?year|nine\s*months?|six\s*months?|three\s*months?|financial\s*year|year|q[1-4]\b|fy\s*\d)/i.test(lower)) return true;
  if (/\b(?:outcome of (?:the )?board|board meeting outcome)\b/i.test(lower) && /\b(?:quarterly\s+)?results?\b/i.test(lower)) return true;

  // 4. Board meeting outcome specifically mentioning financial results
  if (/\b(?:outcome of board|board meeting outcome|outcome of the board)\b/i.test(lower)) {
    if (/\b(?:financial results?|un-?audited|audited|quarter ended|half year ended|year ended|profit and loss|balance sheet)\b/i.test(lower)) {
      return true;
    }
    // Generic outcome of board meeting without financial results is NOT a financial result
    return false;
  }

  return false;
}

export function isIntimationOrNoticeFiling(subject: string = '', details: string = ''): boolean {
  const fullText = `${subject || ''} ${details || ''}`.toLowerCase();
  if (!fullText.trim()) return false;

  // 1. Explicit OUTCOME / RESULTS indicators override any notice keywords
  // (Regulation 33 is specifically Financial Results submission under SEBI LODR)
  // A notice remains a notice even when it names the financial results to be considered.
  if (/to\s*consider\s*(?:and\s*approve)?|meeting\s*(?:is\s*)?scheduled|intimation.*board\s*meeting|notice\s*of\s*board|trading\s*window|regulation\s*29/i.test(fullText) &&
      !/considered\s*and\s*approved|approved\s*(?:the\s*)?(?:un-?audited|audited|financial)\s*results/i.test(fullText)) return true;

  const isDefinitiveOutcome = 
    /^(?:financial results?|results?|results\s*\/\s*dividend|financial results\s*\/\s*dividend)[\.\s\-:]*$/i.test(fullText.trim()) ||
    /\b(?:regulation 33|reg\s*33|reg\.\s*33|lodr\s*33)\b/i.test(fullText) ||
    /\b(?:financial results?|financial result|un-?audited financial results?|audited financial results?|statement of (?:standalone|consolidated|financial) results)\b/i.test(fullText) ||
    /\b(?:considered and approved the (?:un-?audited|audited|financial)|approved the (?:un-?audited|audited|financial) results|approval of (?:un-?audited|audited|financial) results)\b/i.test(fullText) ||
    /\b(?:financial results \(standalone|financial results - standalone|financial results \(consolidated|financial results - consolidated)\b/i.test(fullText);

  if (isDefinitiveOutcome) {
    return false; // It is a genuine OUTCOME, NOT a prior intimation/notice
  }

  // 2. True Prior Notice / Intimations
  const hasIntimationKeywords = 
    /\b(?:prior intimation|notice of board|board meeting intimation|intimation of board|to consider and approve|meeting scheduled|meeting will be held|update on board meeting|rescheduled|trading window|closure of window|closure of trading|regulation 29|reg\s*29|reg\.\s*29)\b/i.test(fullText);

  if (hasIntimationKeywords) {
    return true;
  }

  if (/intimation.*(?:to consider|meeting to be held|scheduled on)/i.test(fullText)) {
    return true;
  }

  if (/newspaper publication|press release|investor presentation|audio recording|transcript|analyst.*meet.*intimation|loss of share|duplicate share|scrutinizer/i.test(fullText)) {
    return true;
  }

  return false;
}

export interface ResultDocumentCheck {
  version: 1; filingId: string; scripCode: string; pdfUrl: string;
  documentSha256: string; checkedAt: string; verdict: 'result' | 'other'; excerpt: string;
}
export function isAmbiguousBoardOutcome(item: any): boolean {
  const text = `${item?.subject || ''} ${item?.details || ''}`;
  return !ancillaryResultTitle.test(item?.subject || '') && /\b(?:outcome of (?:the )?board|board meeting outcome)\b/i.test(text) &&
    !isIntimationOrNoticeFiling(item?.subject, item?.details) && !isPureResultOutcomeFiling(item?.subject, item?.details);
}
/** Bind proof to this filing, security and original official PDF; unrelated summaries confer no evidence. */
export function cachedResultDocumentCheck(item: any): ResultDocumentCheck | null {
  const proof = item?.resultDocumentCheck;
  if (!proof || proof.version !== 1 || proof.filingId !== String(item.id || item.newsId || '') ||
      proof.scripCode !== String(item.scrip_cd || item.scripCode || '') || !/^\d{6}$/.test(proof.scripCode) ||
      proof.pdfUrl !== item.pdfLink || !/^[a-f0-9]{64}$/.test(proof.documentSha256 || '') ||
      !Number.isFinite(Date.parse(proof.checkedAt)) || !['result','other'].includes(proof.verdict) ||
      typeof proof.excerpt !== 'string' || proof.excerpt.length > 1000) return null;
  try {
    const url = new URL(proof.pdfUrl);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
        !['bseindia.com','www.bseindia.com','api.bseindia.com'].includes(url.hostname) ||
        !/^\/xml-data\/corpfiling\/Attach(?:Live|His)\/[^/]+\.pdf$/i.test(url.pathname)) return null;
  } catch { return null; }
  if (proof.verdict === 'result' && !isPureResultOutcomeFiling('', proof.excerpt)) return null;
  return proof;
}
export function resultFilingText(item: any): string {
  const proof = cachedResultDocumentCheck(item);
  return `${item?.subject || ''} ${item?.details || ''} ${proof?.verdict === 'result' ? proof.excerpt : ''}`.trim();
}
export function isVerifiedResultFiling(item: any): boolean {
  return isPureResultOutcomeFiling(item?.subject, item?.details) ||
    (isAmbiguousBoardOutcome(item) && cachedResultDocumentCheck(item)?.verdict === 'result');
}

export function archiveCompletionMessage(job: { processed: number; years?: number; unverifiedDocuments?: number }, verifiedResults?: number): string {
  const range = job.years ? ` across the last ${job.years} year${job.years === 1 ? '' : 's'}` : '';
  const results = typeof verifiedResults === 'number' && Number.isInteger(verifiedResults) && verifiedResults >= 0 ? ` ${verifiedResults} verified result${verifiedResults === 1 ? '' : 's'} in saved history.` : '';
  return `Archive saved: ${job.processed} filing${job.processed === 1 ? '' : 's'}${range}.` + results + (job.unverifiedDocuments
    ? ` ${job.unverifiedDocuments} additional board outcome PDF${job.unverifiedDocuments === 1 ? '' : 's'} still need result verification. Verified result cards remain available.`
    : ' Result cards show verified financial disclosures.');
}
