import { hasExactScripCode } from './scripMatching';
/** A verified detail response updates only the same security and meeting window. */
export function reconcileDeclaredCalendar<T extends Record<string, any>>(items: T[], history: any[], code: string, now = Date.now()): T[] {
  return items.map(item => {
    if (!hasExactScripCode(item, code) || !Number.isFinite(item.meetingTimestamp)) return item;
    const evidence = history.filter(row => hasExactScripCode(row, code) && row.isOutcome === true)
      .map(row => ({ row, ts: Number(row.submissionTimestamp) || Date.parse(row.resultDeclarationTime || '') }))
      .filter(({ ts }) => Number.isFinite(ts) && ts <= now && ts >= item.meetingTimestamp - 6 * 3600000 && ts <= item.meetingTimestamp + 3.5 * 86400000)
      .sort((a, b) => a.ts - b.ts)[0];
    if (!evidence) return item;
    const { row, ts } = evidence;
    return { ...item, isDeclared: true, resultDeclarationTime: row.resultDeclarationTime || new Date(ts).toISOString(),
      bseTimestamp: ts, declarationAnnouncementId: row.id || row.newsId,
      declarationPdfLink: row.pdfLink, declarationSubject: row.subject,
      aiSummary: row.aiSummary || item.aiSummary, aiSummaryEn: row.aiSummaryEn || item.aiSummaryEn };
  });
}
