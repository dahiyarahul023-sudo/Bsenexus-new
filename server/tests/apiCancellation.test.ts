import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Execute the actual browser helper with Firebase/fetch/browser boundaries
// stubbed; do not make live authentication or network requests.
function makeFetch(fetcher: typeof fetch, auth: any = { currentUser: null }, stored: string | null = null) {
  const source = fs.readFileSync('src/api.ts', 'utf8')
    .replace("import { auth, initAppCheck } from './firebase';", '')
    .replace(/\(import\.meta as any\)/g, '({ env: {} })');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replace('export async function', 'async function');
  const events: any[] = [];
  const values = new Map<string, string>(stored ? [['bse_nexus_fb_id_token', stored]] : []);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const window = { dispatchEvent: (event: any) => events.push(event) };
  const run = new Function('auth', 'fetch', 'localStorage', 'window', `${compiled}\nreturn customFetch;`);
  return { customFetch: run(auth, fetcher, storage, window), events, storage };
}

test('cancelled requests preserve AbortError and do not report a network outage', async () => {
  const error = new DOMException('Cancelled', 'AbortError');
  const { customFetch, events } = makeFetch(async () => { throw error; });
  await assert.rejects(customFetch('/api/users/profile'), error);
  assert.equal(events.length, 0);
});

test('cancellation during a 401 retry is propagated without auth-expired or outage events', async () => {
  let calls = 0;
  const error = new DOMException('Cancelled retry', 'AbortError');
  const { customFetch, events } = makeFetch(async () => {
    if (++calls === 1) return new Response('{}', { status: 401 });
    throw error;
  }, { currentUser: { isAnonymous: false, getIdToken: async () => 'firebase.test.token' } });
  await assert.rejects(customFetch('/api/users/profile'), error);
  assert.equal(calls, 2);
  assert.equal(events.length, 0);
});

test('real network failures still return the existing 503 outage response', async () => {
  const { customFetch, events } = makeFetch(async () => { throw new TypeError('Network failed'); });
  const response = await customFetch('/api/users/profile');
  assert.equal(response.status, 503);
  assert.equal(events[0].detail.isOnline, false);
});

test('an HTML 200 API response is a failed read, without retries or leaked page content', async () => {
  let calls = 0;
  const { customFetch, events } = makeFetch(async () => {
    calls++;
    return new Response('<html>Starting Server: private-page-content</html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  });
  const response = await customFetch('/api/gifts/admin');
  assert.equal(response.status, 502);
  assert.equal(response.ok, false);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.code, 'API_NON_JSON_RESPONSE');
  assert.equal(body.upstreamStatus, 200);
  assert.ok(!JSON.stringify(body).includes('private-page-content'));
  assert.equal(events.length, 0);
  assert.equal(calls, 1);
});

test('HTML errors preserve denial status and never automatically replay a gift mutation', async () => {
  for (const status of [403, 404, 503]) {
    let calls = 0;
    const { customFetch } = makeFetch(async () => {
      calls++;
      return new Response('<html>upstream error</html>', { status, headers: { 'Content-Type': 'text/html' } });
    });
    const response = await customFetch('/api/gifts/admin', { method: 'POST', body: '{}' });
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, 'API_NON_JSON_RESPONSE');
    assert.equal(calls, 1);
  }
});

const idToken = (exp: number) => `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`;
test('customFetch drops expired/malformed stored tokens and authenticates using cookie only', async () => {
  for (const stored of [idToken(Date.now() / 1000 - 3600), 'not.a.token']) {
    let headers: Headers | undefined;
    const f = makeFetch(async (_url, options) => {
      headers = new Headers(options?.headers); assert.equal(options?.credentials, 'include');
      return Response.json({ success: true });
    }, { currentUser: null }, stored);
    assert.equal((await f.customFetch('/api/users/profile')).status, 200);
    assert.equal(headers!.has('Authorization'), false); assert.equal(f.storage.getItem('bse_nexus_fb_id_token'), null);
  }
});
test('customFetch force-refreshes an expired Firebase SDK result before sending', async () => {
  const refreshed: boolean[] = []; const current = idToken(Date.now() / 1000 + 3600);
  const f = makeFetch(async (_url, options) => {
    assert.equal(new Headers(options?.headers).get('Authorization'), `Bearer ${current}`); return Response.json({});
  }, { currentUser: { uid: 'owner', getIdToken: async (force: boolean) => { refreshed.push(force); return force ? current : idToken(1); } } });
  await f.customFetch('/auth/verify-pin', { method: 'POST' });
  assert.deepEqual(refreshed, [false, true]);
});
test('a rejected Bearer retries a 401 without Authorization so a valid cookie can recover', async () => {
  const sent: (string | null)[] = [];
  const f = makeFetch(async (_url, options) => {
    sent.push(new Headers(options?.headers).get('Authorization'));
    return sent.length === 1 ? Response.json({ authRequired: true }, { status: 401 }) : Response.json({ success: true });
  }, { currentUser: null }, idToken(Date.now() / 1000 + 3600));
  assert.equal((await f.customFetch('/api/users/profile')).status, 200);
  assert.equal(sent.length, 2); assert.equal(sent[1], null); assert.ok(!f.events.some(e => e.type === 'auth-expired'));
});
test('structured elevation denial is preserved without replay; wrong PIN does not expire identity', async () => {
  let calls = 0;
  const f = makeFetch(async () => { calls++; return Response.json({ adminElevationRequired: true }, { status: 403 }); });
  const response = await f.customFetch('/api/billing/reset-quota', { method: 'POST' });
  assert.equal(response.status, 403); assert.equal((await response.json()).adminElevationRequired, true); assert.equal(calls, 1);
  const pin = makeFetch(async () => Response.json({ error: 'Invalid credentials' }, { status: 401 }));
  assert.equal((await pin.customFetch('/auth/verify-pin', { method: 'POST' })).status, 401);
  assert.equal(pin.events.length, 0);
});

test('an account switch while obtaining a token cancels before any request is sent', async () => {
  let calls = 0;
  const auth: any = { currentUser: { uid: 'old-owner', getIdToken: async () => {
    auth.currentUser = { uid: 'new-owner' };
    return idToken(Date.now() / 1000 + 3600);
  } } };
  const f = makeFetch(async () => { calls++; return Response.json({}); }, auth);
  await assert.rejects(f.customFetch('/api/billing/reset-quota', { method: 'POST' }), (error: any) => error.name === 'AbortError');
  assert.equal(calls, 0); assert.equal(f.events.length, 0);
});
