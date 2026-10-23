import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('BSE-only sync includes missing-master Vishal, coalesces refreshes, invalidates enrichment and retains failures', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-20T10:00:00+05:30') });
  const previousCwd = process.cwd();
  const temporary = mkdtempSync(path.join(tmpdir(), 'calendar-sync-test-'));
  const originalFetch = globalThis.fetch;
  let phase = 0;
  const urls: string[] = [];
  try {
    process.chdir(temporary);
    mkdirSync('data');
    writeFileSync('data/settings.json', JSON.stringify({ autoTelegramCalendar: false }));
    globalThis.fetch = async (input: any) => {
      const url = String(input);
      urls.push(url);
      assert.ok(url.startsWith('https://api.bseindia.com/BseIndiaAPI/api/BoardMeeting/w?'), `Unexpected non-calendar request: ${url}`);
      if (phase === 2) return new Response('Unavailable', { status: 503 });
      const date = phase === 0 ? '21/10/2026' : '22/10/2026';
      return Response.json({ Table: url.includes('scripcode=544307&') ? [{ Purpose_name: 'Financial Results', meeting_date: date, LONG_NAME: 'Vishal Mega Mart Limited', SCRIP_CD: phase === 3 ? '500325' : '544307' }] : [] });
    };
    const service = await import('../services/resultsCalendarService.js');
    const first = service.fetchAndSyncResultsCalendar(true);
    assert.strictEqual(service.fetchAndSyncResultsCalendar(true), first, 'overlapping force refreshes must share the running operation');
    await first;
    assert.equal(urls.filter(url => url.includes('scripcode=544307&')).length, 1);
    const initial = await service.getResultsCalendarSnapshot();
    assert.equal(initial.items.filter(item => item.scripCode === '544307').length, 1);
    assert.equal(initial.items.find(item => item.scripCode === '544307')!.meetingDate, '21/10/2026');
    phase = 1;
    await service.fetchAndSyncResultsCalendar(true);
    const changed = await service.getResultsCalendarSnapshot();
    assert.equal(changed.items.find(item => item.scripCode === '544307')!.meetingDate, '22/10/2026', 'fresh sync must invalidate the old 45-second enriched snapshot');
    const timestamp = changed.lastUpdated;
    phase = 2;
    await service.fetchAndSyncResultsCalendar(true);
    const failed = await service.getResultsCalendarSnapshot();
    assert.equal(failed.items.find(item => item.scripCode === '544307')!.meetingDate, '22/10/2026');
    assert.equal(failed.lastUpdated, timestamp, 'failed source reads must not claim a successful fresh sync');
    const attempts = urls.length;
    await service.fetchAndSyncResultsCalendar(false);
    assert.equal(urls.length, attempts, 'failed sources have a bounded retry cadence');
    const fno = await service.getResultsCalendarData('all', undefined, 'guest', 'fno');
    assert.equal(fno.items.filter(item => item.scripCode === '544307').length, 1);
    assert.equal(fno.calendarIncomplete, true);
    phase = 3;
    await service.fetchAndSyncResultsCalendar(true);
    assert.equal(service.readCachedResultsCalendar().items.find(item => item.scripCode === '544307')!.meetingDate, '22/10/2026', 'a row for another security must not replace the verified meeting');
    const invalidSingle = await service.syncSingleStockResultsCalendar('VMM', '544307');
    assert.equal(invalidSingle.success, false);
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(previousCwd);
    rmSync(temporary, { recursive: true, force: true });
  }
});
