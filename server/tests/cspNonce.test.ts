import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import vm from 'node:vm';
import express from 'express';
import { responseHeaders } from '../security/responseHeaders.js';
import { prepareTrustedHtml, CSP_NONCE_PLACEHOLDER } from '../security/cspNonce.js';
import { cspReportRouter } from '../security/cspReports.js';
import { RenderCache } from '../utils/renderCache.js';

async function fixture(run: (request: (path?: string, host?: string, body?: string, extra?: Record<string, string>) => Promise<any>, cache: RenderCache, logs: any[]) => Promise<void>) {
  const app = express(), cache = new RenderCache(), logs: any[] = [];
  app.use(responseHeaders(true));
  app.use(cspReportRouter(event => logs.push(event)));
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
  assert.equal(scripts.filter(m => !m[1].includes('src=') && !m[1].includes('application/ld+json')).length, 5);
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
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), {
    self: { addEventListener: (name: string, fn: Function) => handlers[name] = fn }, URL, Response,
    fetch: async () => { if (offline) throw new Error('offline'); return new Response('fresh HTML'); },
    caches: { open: () => { cacheCalls++; throw new Error('must not cache HTML'); }, match: () => { cacheCalls++; throw new Error('must not replay HTML'); } },
  });
  let result: Promise<Response>;
  const event = { request: { url: 'https://bsenexus.in/announcements', mode: 'navigate' }, respondWith: (r: Promise<Response>) => result = r };
  handlers.fetch(event); assert.equal(await (await result!).text(), 'fresh HTML');
  offline = true; handlers.fetch(event); assert.equal((await result!).status, 503); assert.equal(cacheCalls, 0);
});
