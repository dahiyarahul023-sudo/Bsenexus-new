import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAnnouncementCronHandler } from '../api/announcementCron.js';
import { withHttpDeadline } from '../utils/httpDeadline.js';

async function harness(poll: () => Promise<any>, backoffMs = () => 0, secret: string | undefined = 'test-secret') {
  let now = 1_000_000;
  const logs: string[] = [];
  const app = express();
  app.get('/api/cron/poll-announcements', createAnnouncementCronHandler({ poll, backoffMs, secret: () => secret, now: () => now, log: line => logs.push(line) }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  return {
    logs, advance(ms: number) { now += ms; },
    request(token: string | null = 'test-secret', query = '') {
      return fetch(`http://127.0.0.1:${address.port}/api/cron/poll-announcements${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    },
    close: () => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }),
  };
}

test('missing/wrong/query-only secret fails closed without invoking ingestion or logging secrets', async () => {
  let calls = 0;
  const h = await harness(async () => { calls++; });
  try {
    for (const [token, query] of [[null, ''], ['wrong-secret', ''], [null, '?token=test-secret']] as const) {
      assert.equal((await h.request(token, query)).status, 401);
    }
    assert.equal(calls, 0);
    assert.ok(h.logs.every(line => !line.includes('test-secret') && !line.includes('wrong-secret')));
  } finally { await h.close(); }
});

test('unconfigured secret returns 401 even with a bearer token', async () => {
  const h = await harness(async () => { throw new Error('must not poll'); }, () => 0, '');
  try { assert.equal((await h.request()).status, 401); } finally { await h.close(); }
});

test('one authorized request returns counts; repeated NEWSID delivery remains idempotent', async () => {
  const seen = new Set<string>();
  let cycles = 0;
  const h = await harness(async () => {
    cycles++;
    const added = seen.has('NEWSID-1') ? 0 : 1;
    seen.add('NEWSID-1');
    return { mode: 'success', fetched: 1, new: added, durationMs: 1 };
  });
  try {
    assert.equal((await (await h.request()).json()).new, 1);
    assert.equal((await (await h.request()).json()).new, 0);
    assert.equal(cycles, 2);
    assert.equal(h.logs.filter(line => line.startsWith('[POLLER] Cycle')).length, 2);
    assert.ok(h.logs.every(line => line.includes('Timestamp IST:') && !line.includes('test-secret')));
  } finally { await h.close(); }
});

test('overlap cannot start a second cycle; completed worker permits the next call', async () => {
  let release!: (value: any) => void;
  let entered!: () => void;
  const enteredPromise = new Promise<void>(resolve => { entered = resolve; });
  let calls = 0;
  const h = await harness(async () => {
    calls++; entered();
    return new Promise(resolve => { release = resolve; });
  });
  try {
    const first = h.request(); await enteredPromise;
    const overlap = await h.request();
    assert.equal(overlap.status, 409);
    assert.equal(calls, 1);
    release({ mode: 'success', fetched: 3, new: 2 });
    assert.equal((await first).status, 200);
  } finally { await h.close(); }
});

test('source failures return retryable 503; backoff skips fetch until eligible', async () => {
  let calls = 0;
  const h = await harness(async () => { calls++; return { mode: 'source-unavailable', fetched: 0, new: 0 }; }, () => 300_000);
  try {
    assert.equal((await h.request()).status, 503);
    assert.equal((await (await h.request()).json()).mode, 'backoff');
    assert.equal(calls, 1);
    h.advance(300_000);
    assert.equal((await h.request()).status, 503);
    assert.equal(calls, 2);
  } finally { await h.close(); }
});

test('an unexpected error releases ownership and never logs exception secrets', async () => {
  let calls = 0;
  const h = await harness(async () => { calls++; throw new Error('Bearer test-secret'); });
  try {
    assert.equal((await h.request()).status, 503);
    h.advance(60_000);
    assert.equal((await h.request()).status, 503);
    assert.equal(calls, 2);
    assert.ok(h.logs.every(line => !line.includes('test-secret')));
  } finally { await h.close(); }
});

test('HTTP deadline covers hung headers and hung bodies even if abort is ignored', async () => {
  for (const phase of ['headers', 'body']) {
    let signal!: AbortSignal;
    await assert.rejects(withHttpDeadline(async requestSignal => {
      signal = requestSignal;
      if (phase === 'body') await Promise.resolve({ ok: true });
      return new Promise<never>(() => {});
    }, 10), /timed out/);
    assert.equal(signal.aborted, true);
  }
});

test('parent cancellation aborts an in-flight HTTP operation and denies already cancelled work', async () => {
  const parent = new AbortController();
  let invoked = 0;
  const action = async () => { invoked++; return new Promise<never>(() => {}); };
  const work = withHttpDeadline(action, 1000, parent.signal);
  await Promise.resolve();
  parent.abort();
  await assert.rejects(work, /cancelled/);
  await assert.rejects(withHttpDeadline(action, 1000, parent.signal), /cancelled/);
  assert.equal(invoked, 1);
});
