import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { ADR_COMPANIES, readAdrSnapshot } from '../../src/shared/adr.js';

test('ADR persistence uses only scoped immutable public session keys, bounded reads and no global bot settings', async () => {
  const calls: any[] = []; const records = new Map<string, any>();
  const client = { from(table: string) {
    calls.push(['table', table]); let writing: any[] | null = null;
    const query: any = {
      select: (fields: string) => { calls.push(['select', fields]); return query; },
      like: (field: string, pattern: string) => { calls.push(['like', field, pattern]); return query; },
      order: (field: string, options: any) => { calls.push(['order', field, options.ascending]); return query; },
      limit: (limit: number) => { calls.push(['limit', limit]); return query; },
      upsert: (rows: any[], options: any) => { writing = rows; calls.push(['conflict', options.onConflict, options.ignoreDuplicates]); return query; },
      abortSignal: async (signal: AbortSignal) => {
        assert.ok(signal instanceof AbortSignal);
        for (const row of writing || []) if (!records.has(row.key)) records.set(row.key, row);
        return { data: [...records.values()].sort((a, b) => b.key.localeCompare(a.key)), error: null };
      },
    }; return query;
  } };
  const exports: any = {};
  const source = ts.transpileModule(fs.readFileSync('server/database/adrSnapshotDao.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, Date, AbortSignal, require(name: string) {
    if (name.endsWith('/supabase.js')) return { getSupabase: () => client, isSupabaseConfigured: () => true };
    if (name.endsWith('/adr.js')) return { readAdrSnapshot };
    return {};
  } });
  const day = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const previousDay = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const item = { ...ADR_COMPANIES[0], close: 101, previousClose: 100, changePercent: 1.0000000000000009, volume: 50000, sessionDate: day, previousSessionDate: previousDay, sessionCloseAt: Date.parse(day + 'T20:00:00Z'), currency: 'USD', source: 'Yahoo Finance', corporateAction: false };
  await exports.adrSnapshotStore.save({ checkedAt: Date.now(), items: [item] });
  await exports.adrSnapshotStore.save({ checkedAt: Date.now(), items: [{ ...item, close: 999 }] });
  assert.equal(records.size, 1); assert.equal([...records.values()][0].value.items[0].close, 101);
  assert.equal([...records.keys()][0], `market:adr:v1:${day}:INFY`);
  const restored = readAdrSnapshot(await exports.adrSnapshotStore.read())!;
  assert.equal(restored.items.length, 1); assert.equal(restored.refreshFailed, true);
  assert.ok(calls.some(call => call.join(':') === 'like:key:market:adr:v1:%'));
  assert.ok(calls.some(call => call.join(':') === 'limit:40'));
  assert.ok(calls.some(call => call.join(':') === 'conflict:key:true'));
});
