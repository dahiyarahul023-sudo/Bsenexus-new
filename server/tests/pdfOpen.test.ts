import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Writable } from 'node:stream';
import express from 'express';
import { createPdfOpenRouter, streamPdf } from '../api/pdfOpen.js';
import { isAllowedBseDocumentUrl } from '../utils/bseDocument.js';

const url = 'https://www.bseindia.com/filing.pdf';
async function fixture(router: express.Router, run: (request: (path?: string, xff?: string) => Promise<any>) => Promise<void>) {
  const app = express(); app.set('trust proxy', 1); app.use(router);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const request = (path = '/pdf-open?url=' + encodeURIComponent(url), xff = 'spoof, 198.51.100.30') => new Promise<any>((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: (server.address() as any).port, path, headers: { 'X-Forwarded-For': xff } }, res => {
      const chunks: Buffer[] = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })); res.on('error', reject);
    }).on('error', reject);
  });
  try { await run(request); } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
}
test('running byte cap cancels an oversized unknown-length body mid-stream', async () => {
  let pulls = 0, cancelled = false; const received: Buffer[] = [];
  const body = new ReadableStream<Uint8Array>({ pull(c) { pulls++; c.enqueue(new Uint8Array(6)); if (pulls === 20) c.close(); }, cancel() { cancelled = true; } });
  const sink = new Writable({ write(chunk, _encoding, done) { received.push(Buffer.from(chunk)); done(); } });
  await assert.rejects(streamPdf(new Response(body), sink as any, new AbortController().signal, 10), /PDF_TOO_LARGE/);
  assert.equal(cancelled, true); assert.ok(pulls < 20); assert.equal(Buffer.concat(received).length, 6);
});
test('global admission cap returns 503/Retry-After and releases after completion', async () => {
  let unblock!: () => void, started!: () => void, calls = 0;
  const ready = new Promise<void>(r => started = r), hold = new Promise<void>(r => unblock = r);
  const fetchDocument = async () => { calls++; if (calls === 1) { started(); await hold; } return new Response('%PDF-fixture', { headers: { 'Content-Type': 'application/pdf' } }); };
  await fixture(createPdfOpenRouter({ fetchDocument, maxInFlight: 1 }), async request => {
    const first = request(); await ready;
    const capped = await request(undefined, 'different, 198.51.100.31'); assert.equal(capped.status, 503); assert.equal(capped.headers['retry-after'], '5'); assert.equal(calls, 1);
    unblock(); assert.equal((await first).status, 200);
    assert.equal((await request()).status, 200); assert.equal(calls, 2);
  });
});
test('streamed PDF retains content type and sanitized filename; announced oversize is cancelled before sending', async () => {
  await fixture(createPdfOpenRouter({ fetchDocument: async () => new Response('%PDF-bytes'), maxBytes: 100 }), async request => {
    const r = await request('/pdf-open?url=' + encodeURIComponent(url) + '&file=' + encodeURIComponent('../bad"\r\nname.pdf'));
    assert.equal(r.status, 200); assert.equal(r.headers['content-type'], 'application/pdf'); assert.equal(r.headers['content-disposition'], 'inline; filename="..badname.pdf"'); assert.equal(r.body.toString(), '%PDF-bytes');
  });
  let cancelled = false;
  await fixture(createPdfOpenRouter({ fetchDocument: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'Content-Length': '101' } }), maxBytes: 100 }), async request => {
    const r = await request(); assert.equal(r.status, 413); assert.equal(cancelled, true); assert.equal(r.headers['cache-control'], 'no-store');
  });
});
test('forbidden redirect is never fetched; proxy fallback Location stays on the BSE allowlist', async () => {
  const original = globalThis.fetch; const requested: string[] = [];
  globalThis.fetch = async input => { requested.push(String(input)); return new Response(null, { status: 302, headers: { Location: 'http://169.254.169.254/latest/meta-data/' } }); };
  try { await fixture(createPdfOpenRouter(), async request => {
    const r = await request(); assert.equal(r.status, 302); assert.ok(isAllowedBseDocumentUrl(r.headers.location)); assert.deepEqual(requested, [url]);
  }); } finally { globalThis.fetch = original; }
});
test('dedicated limiter refuses the 21st request and spoofed leftmost XFF cannot reset it', async () => {
  await fixture(createPdfOpenRouter(), async request => {
    for (let i = 0; i < 20; i++) assert.equal((await request('/pdf-open', `${i}.1.1.1, 198.51.100.30`)).status, 302);
    const r = await request('/pdf-open', 'fresh-spoof, 198.51.100.30'); assert.equal(r.status, 429); assert.ok(r.headers['retry-after']);
  });
});
