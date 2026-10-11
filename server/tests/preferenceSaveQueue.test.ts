import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
import { createPreferenceSaveQueue } from '../../src/utils/preferenceSaveQueue.js';

type Prefs = { alerts: boolean; summary: boolean };
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function waitFor(check: () => boolean) {
  for (let n = 0; n < 100; n++) {
    if (check()) return;
    await pause(5);
  }
  assert.fail('Timed out waiting for queued save');
}

test('debounced updates merge fields and settle every caller', async () => {
  let state: Prefs = { alerts: false, summary: false };
  const sent: Prefs[] = [];
  const queue = createPreferenceSaveQueue({
    read: () => state, apply: prefs => { state = prefs; },
    save: async prefs => { sent.push(prefs); }, status: () => {}, debounceMs: 1,
  });
  const results = await Promise.all([queue.update({ alerts: true }), queue.update({ summary: true })]);
  assert.deepEqual(results, [true, true]);
  assert.deepEqual(sent, [{ alerts: true, summary: true }]);
  queue.dispose();
});

test('writes never overlap and an older failure cannot roll back a newer update', async () => {
  let state: Prefs = { alerts: false, summary: false };
  const pending: ReturnType<typeof deferred>[] = [];
  const sent: Prefs[] = [];
  const queue = createPreferenceSaveQueue({
    read: () => state, apply: prefs => { state = prefs; },
    save: prefs => { sent.push(prefs); const request = deferred(); pending.push(request); return request.promise; },
    status: () => {}, debounceMs: 1,
  });
  const first = queue.update({ alerts: true });
  await waitFor(() => sent.length === 1);
  const second = queue.update({ summary: true });
  await pause(10);
  assert.equal(sent.length, 1);
  pending[0].reject(new Error('Older request failed'));
  assert.equal(await first, false);
  await waitFor(() => sent.length === 2);
  assert.deepEqual(state, { alerts: true, summary: true });
  assert.deepEqual(sent[1], state);
  pending[1].resolve();
  assert.equal(await second, true);
  queue.dispose();
});

test('a failed final batch rolls back to the last confirmed server state', async () => {
  let state: Prefs = { alerts: false, summary: false };
  let calls = 0;
  const queue = createPreferenceSaveQueue({
    read: () => state, apply: prefs => { state = prefs; },
    save: async () => { if (++calls > 1) throw new Error('Rejected'); },
    status: () => {}, debounceMs: 1,
  });
  assert.equal(await queue.update({ alerts: true }), true);
  const second = queue.update({ alerts: false });
  const third = queue.update({ summary: true });
  assert.deepEqual(await Promise.all([second, third]), [false, false]);
  assert.deepEqual(state, { alerts: true, summary: false });
  queue.dispose();
});

test('disposal settles pending callers and ignores in-flight completion', async () => {
  let state: Prefs = { alerts: false, summary: false };
  const request = deferred();
  let started = false;
  let statusCalls = 0;
  const queue = createPreferenceSaveQueue({
    read: () => state, apply: prefs => { state = prefs; },
    save: () => { started = true; return request.promise; },
    status: () => { statusCalls++; }, debounceMs: 1,
  });
  const result = queue.update({ alerts: true });
  await waitFor(() => started);
  queue.dispose();
  const callsAtDispose = statusCalls;
  request.resolve();
  assert.equal(await result, false);
  await pause(5);
  assert.equal(statusCalls, callsAtDispose);
  assert.equal(await queue.update({ alerts: false }), false);
});
