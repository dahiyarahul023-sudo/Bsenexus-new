import { createHash } from 'node:crypto';
import { fetchBseDocument, isAllowedBseDocumentUrl, readBoundedDocument } from '../utils/bseDocument.js';
import { isAmbiguousBoardOutcome, type ResultDocumentCheck } from '../../src/shared/resultFiling.js';

/** Small proof metadata only. No PDF/text archive, AI provider, or notification side effect. */
export async function checkResultDocument(item: any, deps: {
  request?: typeof fetchBseDocument; extract?: (buffer: Buffer) => Promise<string>; now?: () => number; signal?: AbortSignal;
} = {}): Promise<ResultDocumentCheck | null> {
  deps.signal?.throwIfAborted();
  if (!isAmbiguousBoardOutcome(item) || !/^\d{6}$/.test(String(item.scrip_cd || '')) ||
      !item.newsId || !isAllowedBseDocumentUrl(item.pdfLink || '')) return null;
  const response = await (deps.request || fetchBseDocument)(item.pdfLink, {
    signal: deps.signal ? AbortSignal.any([deps.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000), headers: { Referer: 'https://www.bseindia.com/', 'User-Agent': 'Mozilla/5.0' },
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error('Result PDF unavailable'); }
  const buffer = await readBoundedDocument(response, 8 * 1024 * 1024);
  if (buffer.subarray(0,5).toString() !== '%PDF-') throw new Error('Result document is not a PDF');
  deps.signal?.throwIfAborted();
  let text: string;
  if (deps.extract) text = await deps.extract(buffer);
  else {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const parsed = await Promise.race([parser.getText({ first: 5 }), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Result PDF extraction timed out')), 10000);
      })]);
      text = parsed.text;
    } finally { clearTimeout(timer); await parser.destroy(); }
  }
  deps.signal?.throwIfAborted();
  const clean = text.slice(0,80000).replace(/\s+/g,' ').trim();
  if (clean.length < 100 || !new RegExp(`\\b${item.scrip_cd}\\b`).test(clean)) throw new Error('Result PDF identity or text could not be verified');
  // Approval and reporting period must occur together; a schedule, voting result,
  // investor deck or an unrelated financial comparison is insufficient.
  const match = clean.match(/\b(?:considered\s+and\s+approved|approved(?=\s+(?:the\s+)?(?:un-?audited|audited|standalone|consolidated|financial)))[\s\S]{0,180}?\bfinancial\s+results?\b[\s\S]{0,300}?\bended\b[\s\S]{0,70}/i);
  if (!match) throw new Error('Result PDF needs further verification');
  return { version: 1, filingId: String(item.newsId), scripCode: String(item.scrip_cd), pdfUrl: item.pdfLink,
    documentSha256: createHash('sha256').update(buffer).digest('hex'), checkedAt: new Date((deps.now || Date.now)()).toISOString(),
    verdict: 'result', excerpt: match[0].slice(0,1000) };
}
