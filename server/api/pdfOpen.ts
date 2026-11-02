import express from 'express';
import rateLimit from 'express-rate-limit';
import { once } from 'node:events';
import { fetchBseDocument, isAllowedBseDocumentUrl } from '../utils/bseDocument.js';

const MAX_PDF_BYTES = 25 * 1024 * 1024;

/** Bounded by bytes actually read, with backpressure; never concatenate chunks. */
export async function streamPdf(response: Response, res: express.Response, signal: AbortSignal, maxBytes = MAX_PDF_BYTES) {
  if (Number(response.headers.get('content-length') || 0) > maxBytes) {
    await response.body?.cancel(); throw new Error('PDF_TOO_LARGE');
  }
  const reader = response.body?.getReader();
  if (!reader) { res.end(); return; }
  let bytes = 0, complete = false;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    for (;;) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error('PDF_TOO_LARGE');
      if (!res.write(value)) await once(res, 'drain', { signal });
    }
    complete = true; res.end();
  } finally {
    signal.removeEventListener('abort', cancel);
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function createPdfOpenRouter({ fetchDocument = fetchBseDocument, maxInFlight = 16, maxBytes = MAX_PDF_BYTES } = {}) {
  const router = express.Router();
  // One instance of this router is mounted in apiRouter: shared across all IPs
  // in the Cloud Run process; never a per-IP semaphore or queued download.
  let inFlight = 0;
  router.get('/pdf-open', rateLimit({
    windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false,
    validate: { xForwardedForHeader: false, forwardedHeader: false, default: true },
    message: { success: false, error: 'Too many PDF requests. Please try again in a minute.' },
  }), async (req, res) => {
    let rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (rawUrl.startsWith('http://')) {
      rawUrl = 'https://' + rawUrl.slice(7);
    }
    const filename = typeof req.query.file === 'string' ? req.query.file.trim() : '';
    const newsId = typeof req.query.newsId === 'string' ? req.query.newsId.trim() : '';
    const scrip = typeof req.query.scrip === 'string' ? req.query.scrip.trim() : '';

    let cleanFile = filename.replace(/^.*[\\/]/, '').replace(/[^a-zA-Z0-9_\-.]/g, '').trim();
    if (!cleanFile && rawUrl) {
      const lastPart = rawUrl.split('/').pop()?.split('?')[0] || '';
      if (/\.pdf$/i.test(lastPart)) {
        cleanFile = lastPart.replace(/[^a-zA-Z0-9_\-.]/g, '').trim();
      }
    }

    if (inFlight >= maxInFlight) {
      const redirectTarget = isAllowedBseDocumentUrl(rawUrl) ? rawUrl : (cleanFile ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${cleanFile}` : 'https://www.bseindia.com/corporates/ann.html');
      return res.redirect(redirectTarget);
    }
    inFlight++;
    const controller = new AbortController();
    const closed = () => { if (!res.writableFinished) controller.abort(); };
    res.once('close', closed);
    const candidates: string[] = [];
    try {
      if (isAllowedBseDocumentUrl(rawUrl)) {
        candidates.push(rawUrl);
        if (rawUrl.includes('/AttachLive/')) candidates.push(rawUrl.replace('/AttachLive/', '/AttachHis/'));
        else if (rawUrl.includes('/AttachHis/')) candidates.push(rawUrl.replace('/AttachHis/', '/AttachLive/'));
      }
      if (cleanFile) {
        candidates.push(
          `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${cleanFile}`,
          `https://www.bseindia.com/xml-data/corpfiling/AttachHis/${cleanFile}`
        );
      }
      const cleanNewsId = newsId.replace(/[^a-zA-Z0-9_-]/g, '');
      if (cleanNewsId) {
        candidates.push(`https://www.bseindia.com/corporates/anndet_new.aspx?origid=${encodeURIComponent(cleanNewsId)}`);
      }
      if (scrip && /^\d{5,7}$/.test(scrip)) {
        candidates.push(`https://www.bseindia.com/stock-share-price/stock/${scrip}/announcements/`);
      }
      // Generous 20-second deadline covers slow BSE response, redirects, and streaming.
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]);
      for (const url of [...new Set(candidates)]) {
        if (!isAllowedBseDocumentUrl(url)) continue;
        let response: Response;
        try {
          response = await fetchDocument(url, { method: 'GET', signal, headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/pdf,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Referer': 'https://www.bseindia.com/',
          } });
        } catch { if (signal.aborted) break; continue; }
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        const isPdf = contentType.includes('application/pdf') || (!contentType.includes('text/html') && new URL(url).pathname.toLowerCase().endsWith('.pdf'));

        if (response.ok && isPdf) {
          res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
          res.set('Content-Type', 'application/pdf');
          res.set('Content-Disposition', `inline; filename="${cleanFile || 'bse_filing.pdf'}"`);
          try { await streamPdf(response, res, signal, maxBytes); }
          catch (error) {
            controller.abort();
            if (res.headersSent) res.destroy();
            else res.removeHeader('Content-Disposition');
            if (!res.headersSent && !res.destroyed) res.status(error instanceof Error && error.message === 'PDF_TOO_LARGE' ? 413 : 503).set('Cache-Control', 'no-store').type('text').send('The PDF download could not be completed.');
          }
          return;
        }
        await response.body?.cancel();
        if (response.ok && url.includes('anndet_new.aspx')) return res.redirect(url);
      }
      if (!res.destroyed) return res.redirect(candidates.find(isAllowedBseDocumentUrl) || 'https://www.bseindia.com/corporates/ann.html');
    } catch {
      if (res.headersSent) res.destroy();
      else if (!res.destroyed) res.redirect(candidates.find(isAllowedBseDocumentUrl) || 'https://www.bseindia.com/corporates/ann.html');
    } finally {
      controller.abort(); res.off('close', closed); inFlight--;
    }
  });
  return router;
}
export const pdfOpenRouter = createPdfOpenRouter();
