import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import vm from 'node:vm';
import express from 'express';
import { responseHeaders } from '../security/responseHeaders.js';
import { prepareTrustedHtml, CSP_NONCE_PLACEHOLDER, isCspReportOnlyEnabled, renderCspServiceWorker } from '../security/cspNonce.js';
import { cspReportRouter } from '../security/cspReports.js';
import { RenderCache } from '../utils/renderCache.js';

async function fixture(run: (request: (path?: string, host?: string, body?: string, extra?: Record<string, string>) => Promise<any>, cache: RenderCache, logs: any[]) => Promise<void>, reportOnly = true) {
  const app = express(), cache = new RenderCache(), logs: any[] = [];
  app.use(responseHeaders(true, reportOnly));
  if (reportOnly) app.use(cspReportRouter(event => logs.push(event)));
  app.get('/cached', cache.middleware({ ttlMs: 60_000 }), (_req, res) => res.type('html').send(prepareTrustedHtml('<html><script nonce="__CSP_NONCE__">window.boot=true</script></html>') + '<script nonce="__CSP_NONCE__">evil()</script>'));
  app.get('*', (_req, res) => res.type('html').send(prepareTrustedHtml(fs.readFileSync('index.html', 'utf8'))));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const request = (path = '/', host = 'bsenexus.in', body?: string, extra: Record<string, string> = {}) => new Promise<any>((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: (server.address() as any).port, path, method: body === undefined ? 'GET' : 'POST', headers: { Host: host, 'Content-Type': 'application/csp-report', ...extra } }, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', chunk => text += chunk); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    }); req.on('error', reject); req.end(body);
  });
  try { await run(request, cache, logs); } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
const nonce = (r: any) => r.headers['content-security-policy-report-only']?.match(/'nonce-([^']+)'/)?.[1];

test('trial activation requires the explicit server true setting', () => {
  assert.equal(isCspReportOnlyEnabled({}), false);
  for (const value of ['', 'false', '1', 'TRUE']) assert.equal(isCspReportOnlyEnabled({ CSP_REPORT_ONLY_ENABLED: value }), false);
  assert.equal(isCspReportOnlyEnabled({ CSP_REPORT_ONLY_ENABLED: 'true' }), true);
});

test('disabled trial retains canonical protection, public caching and conditional responses', () => fixture(async (request, _cache, logs) => {
  const first = await request('/cached');
  assert.equal(first.headers['content-security-policy-report-only'], undefined);
  assert.match(first.headers['content-security-policy'], /frame-ancestors 'self'/);
  assert.equal(first.headers['x-frame-options'], 'SAMEORIGIN');
  assert.match(first.headers['cache-control'], /public/);
  const second = await request('/cached', 'bsenexus.in', undefined, { 'If-None-Match': first.headers.etag });
  assert.equal(second.status, 304);
  assert.equal((await request('/api/security/csp-report', 'bsenexus.in', '{}')).status, 404);
  assert.deepEqual(logs, []);
}, false));

test('disabled trial keeps uncached HTML stable for ordinary conditional requests', () => fixture(async request => {
  const first = await request('/');
  const second = await request('/', 'bsenexus.in', undefined, { 'If-None-Match': first.headers.etag });
  assert.equal(second.status, 304);
  assert.doesNotMatch(first.text, /nonce="__BN_CSP_|nonce="[A-Za-z0-9+/]{32}"/);
}, false));

test('report-only script policy is canonical only and never enforces script-src', () => fixture(async request => {
  for (const host of ['bsenexus.in', 'www.bsenexus.in']) {
    const r = await request('/', host); assert.ok(nonce(r));
    assert.match(r.headers['content-security-policy-report-only'], /object-src 'none'; base-uri 'self'; report-uri/);
    assert.doesNotMatch(r.headers['content-security-policy'], /script-src/);
    assert.ok(r.text.includes(`nonce="${nonce(r)}"`));
    assert.doesNotMatch(r.text, /<script[^>]*nonce=[^>]*type="application\/ld\+json"/);
  }
  for (const [host, path] of [['preview.ai.studio', '/'], ['bsenexus.in', '/embed/widget']]) {
    const r = await request(path, host); assert.equal(nonce(r), undefined); assert.equal(r.headers['x-frame-options'], undefined); assert.ok(!r.text.includes(CSP_NONCE_PLACEHOLDER), 'Private template marker must never leak through preview/embed hosts');
  }
}));
test('cache retains a private placeholder; every hit and conditional read gets a matching fresh nonce', () => fixture(async (request, cache) => {
  const first = await request('/cached'); const second = await request('/cached', 'bsenexus.in', undefined, { 'If-None-Match': first.headers.etag });
  assert.equal(first.headers['x-cache'], 'MISS'); assert.equal(second.headers['x-cache'], 'HIT'); assert.equal(second.status, 200);
  assert.notEqual(nonce(first), nonce(second));
  for (const r of [first, second]) {
    assert.ok(r.text.includes(`nonce="${nonce(r)}">window.boot`));
    assert.ok(r.text.includes('nonce="__CSP_NONCE__">evil()')); // never bless final untrusted HTML
    assert.equal(r.headers['cache-control'], 'private, no-store');
    assert.ok(!r.text.includes(CSP_NONCE_PLACEHOLDER));
  }
  assert.ok(cache.get('/cached')!.body.includes(CSP_NONCE_PLACEHOLDER));
}));
test('all trusted source inline boot scripts are explicitly marked; JSON-LD remains data', () => {
  const scripts = [...fs.readFileSync('index.html', 'utf8').matchAll(/<script\b([^>]*)>/g)];
  assert.equal(scripts.filter(m => !m[1].includes('src=') && !m[1].includes('application/ld+json')).length, 6);
  for (const script of scripts) if (!script[1].includes('application/ld+json')) assert.match(script[1], /nonce="__CSP_NONCE__"/);
});
test('report endpoint strips URL secrets, caps bodies and rate limits without auth', () => fixture(async (request, _cache, logs) => {
  const payload = JSON.stringify({ 'csp-report': { 'effective-directive': 'script-src-elem', 'blocked-uri': 'https://evil.test/path?token=secret', 'document-uri': 'https://bsenexus.in/?secret=hidden', 'script-sample': 'private text' } });
  assert.equal((await request('/api/security/csp-report', 'bsenexus.in', payload)).status, 204);
  assert.deepEqual(logs, [{ directive: 'script-src-elem', blockedOrigin: 'https://evil.test' }]);
  assert.equal((await request('/api/security/csp-report', 'bsenexus.in', JSON.stringify({ a: 'x'.repeat(3000) }))).status, 413);
  for (let i = 0; i < 18; i++) assert.equal((await request('/api/security/csp-report', 'bsenexus.in', '{}')).status, 204);
  assert.equal((await request('/api/security/csp-report', 'bsenexus.in', '{}')).status, 429);
}));
test('service worker never caches/replays nonce HTML and cold offline navigation is explicit', async () => {
  const handlers: Record<string, Function> = {}; let cacheCalls = 0; let offline = false;
  vm.runInNewContext(renderCspServiceWorker(fs.readFileSync('public/sw.js', 'utf8'), true), {
    self: { addEventListener: (name: string, fn: Function) => handlers[name] = fn }, URL, Response,
    fetch: async () => { if (offline) throw new Error('offline'); return new Response('fresh HTML'); },
    caches: { open: () => { cacheCalls++; throw new Error('must not cache HTML'); }, match: () => { cacheCalls++; throw new Error('must not replay HTML'); } },
  });
  let result: Promise<Response>;
  const event = { request: { url: 'https://bsenexus.in/announcements', mode: 'navigate' }, respondWith: (r: Promise<Response>) => result = r };
  handlers.fetch(event); assert.equal(await (await result!).text(), 'fresh HTML');
  offline = true; handlers.fetch(event); assert.equal((await result!).status, 503); assert.equal(cacheCalls, 0);
});

test('disabled worker retains online HTML for cold offline navigation and tolerates cache-write failure', async () => {
  const handlers: Record<string, Function> = {};
  const saved = new Map<string, Response>();
  let offline = false, writeFails = false;
  vm.runInNewContext(renderCspServiceWorker(fs.readFileSync('public/sw.js', 'utf8'), false), {
    self: { addEventListener: (name: string, fn: Function) => handlers[name] = fn }, URL, Response,
    fetch: async () => { if (offline) throw new Error('offline'); return new Response('<html>saved shell</html>'); },
    caches: {
      open: async () => ({ put: async (request: any, response: Response) => { if (writeFails) throw new Error('quota'); saved.set(request.url, response); } }),
      match: async (request: any) => saved.get(typeof request === 'string' ? request : request.url)?.clone(),
    },
  });
  let result!: Promise<Response>; const pending: Promise<any>[] = [];
  const event = { request: { url: 'https://bsenexus.in/announcements', mode: 'navigate' }, respondWith: (p: Promise<Response>) => result = p, waitUntil: (p: Promise<any>) => pending.push(p) };
  handlers.fetch(event);
  assert.equal(await (await result).text(), '<html>saved shell</html>');
  await Promise.all(pending.splice(0));
  offline = true; handlers.fetch(event);
  assert.equal(await (await result).text(), '<html>saved shell</html>');
  await Promise.all(pending.splice(0));
  offline = false; writeFails = true; handlers.fetch(event);
  assert.equal((await result).status, 200);
  await Promise.all(pending);
});
