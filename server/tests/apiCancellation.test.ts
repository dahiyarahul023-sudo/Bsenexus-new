import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Execute the actual browser helper with Firebase/fetch/browser boundaries
// stubbed; do not make live authentication or network requests.
function makeFetch(fetcher: typeof fetch, auth: any = { currentUser: null }) {
  const source = fs.readFileSync('src/api.ts', 'utf8')
    .replace("import { auth, initAppCheck } from './firebase';", '')
    .replace(/\(import\.meta as any\)/g, '({ env: {} })');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replace('export async function', 'async function');
  const events: any[] = [];
  const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const window = { dispatchEvent: (event: any) => events.push(event) };
  const run = new Function('auth', 'fetch', 'localStorage', 'window', `${compiled}\nreturn customFetch;`);
  return { customFetch: run(auth, fetcher, storage, window), events };
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
