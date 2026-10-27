import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import express from 'express';
import { once } from 'node:events';
import { createAdrHandler } from '../api/adr.js';
import type { AppNotification } from '../database/notificationDao.js';
import type { AdrSnapshot } from '../../src/shared/adr.js';

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'bsenexus-adr-inbox-')));

const notification: AppNotification = { id: 'adr_test_day_owner', userId: 'adr-owner', title: 'Example ADR: +5.00%', message: 'Source session', type: 'GENERAL', priority: 'HIGH', symbol: 'INFY', scripCode: '500209', timestamp: 1000, isRead: false, isWatchlist: true };

test('durable insert-once survives concurrency/restart and preserves the original read flag, owner and arrival time', async t => {
  const db = new PGlite();
  await db.exec('create table notifications(id text primary key, user_id text not null, payload jsonb not null);');
  const storage = await import('../database/supabase.js');
  const dao = await import('../database/notificationDao.js');
  process.env.SUPABASE_URL = 'https://adr-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-adr-key';
  storage.resetSupabaseClient();
  let fail = false;
  t.mock.method(storage.getSupabase(), 'from', (table: string) => {
    assert.equal(table, 'notifications');
    return { upsert: (row: any, options: any) => {
      assert.deepEqual(options, { onConflict: 'id', ignoreDuplicates: true });
      return { select: async (columns: string) => {
        assert.equal(columns, 'id');
        if (fail) return { data: null, error: new Error('synthetic outage') };
        const result = await db.query('insert into notifications(id,user_id,payload) values ($1,$2,$3) on conflict(id) do nothing returning id', [row.id, row.user_id, JSON.stringify(row)]);
        return { data: result.rows, error: null };
      } };
    } } as any;
  });
  try {
    const results = await Promise.all([dao.addNotificationOnce(notification), dao.addNotificationOnce(notification)]);
    assert.equal(results.filter(Boolean).length, 1);
    await db.query("update notifications set payload = jsonb_set(payload, '{is_read}', 'true') where id=$1", [notification.id]);
    // A new DAO module simulates a process whose memory contains no claim for this event.
    const restarted = await import(`../database/notificationDao.js?adr-restart=${Date.now()}`);
    assert.equal(await restarted.addNotificationOnce({ ...notification, timestamp: 9999 }), false);
    const row = (await db.query<any>('select user_id,payload from notifications where id=$1', [notification.id])).rows[0];
    assert.equal(row.user_id, 'adr-owner'); assert.equal(row.payload.timestamp, 1000); assert.equal(row.payload.is_read, true);
    fail = true;
    await assert.rejects(dao.addNotificationOnce({ ...notification, id: 'outage' }), (error: any) => error.code === 'PAYMENT_STORE_UNAVAILABLE');
    await assert.rejects(dao.addNotificationOnce({ ...notification, userId: 'system' }));
    await assert.rejects(dao.addNotificationOnce({ ...notification, userId: 'guest' }));
  } finally {
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    storage.resetSupabaseClient(); await db.close();
  }
});

test('public ADR read exposes partial data and an honest outage without caching failure as an empty success', async t => {
  const snapshot: AdrSnapshot = { checkedAt: 1000, status: 'partial', items: [{ symbol: 'INFY' } as any], unavailableSymbols: ['HDB'] };
  let current = snapshot; let fail = false;
  const app = express(); app.get('/api/market/adr', createAdrHandler(async () => { if (fail) throw Error('private upstream detail'); return current; }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.close(); server.closeAllConnections(); });
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/api/market/adr`;
  let response = await fetch(url);
  assert.equal(response.status, 200); assert.equal((await response.json()).status, 'partial');
  current = { ...snapshot, items: [], status: 'unavailable' };
  response = await fetch(url); assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
  fail = true; response = await fetch(url);
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'ADR quotes are unavailable' });
});
