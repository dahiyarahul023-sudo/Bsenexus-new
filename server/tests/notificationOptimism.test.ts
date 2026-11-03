import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUnreadNotificationCounter } from '../../src/utils/unreadNotificationCount';

test('rows and shared badge can update before a slow read POST; stale polls cannot restore it', async () => {
  let resolveOld!: (value: unknown) => void;
  let calls = 0;
  const values: any[] = [];
  const counter = createUnreadNotificationCounter(async () => {
    if (++calls === 2) return new Promise(resolve => { resolveOld = resolve; });
    return { unreadCount: calls === 1 ? 3 : 0 };
  }, value => values.push(value));
  counter.setOwner('a');
  await counter.refresh();
  const oldRead = counter.refresh();
  const finish = counter.beginRead('a', 'all');
  assert.deepEqual(values.at(-1), { owner: 'a', count: 0 });
  await counter.refresh();
  assert.equal(calls, 2, 'polls wait for the mutation');
  resolveOld({ unreadCount: 3 });
  await oldRead;
  assert.equal(values.at(-1).count, 0);
  finish(true);
  await Promise.resolve();
  assert.equal(values.at(-1).count, 0);
});

test('failed read restores its count and a prior owner cannot change a new account', async () => {
  const values: any[] = [];
  let fail = false;
  const counter = createUnreadNotificationCounter(async () => {
    if (fail) throw Error('Offline');
    return { unreadCount: 3 };
  }, value => values.push(value));
  counter.setOwner('a');
  await counter.refresh();
  const finish = counter.beginRead('a', 1);
  assert.equal(values.at(-1).count, 2);
  fail = true;
  finish(false);
  assert.equal(values.at(-1).count, 3);
  const late = counter.beginRead('a', 'all');
  counter.setOwner('b');
  late(false);
  assert.deepEqual(values.at(-1), { owner: 'b', count: null });
});
