import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { calendarDayKey, calendarDayStart, projectCalendarTiming } from '../../src/shared/calendarTiming.js';

test('a saved Today row becomes Archive exactly at IST midnight, regardless of browser/server timezone or cached status', () => {
  const meeting = { meetingTimestamp: Date.parse('2026-10-22T00:00:00+05:30'), daysLeft: 0, status: 'TODAY', isDeclared: false };
  const before = Date.parse('2026-10-22T23:59:59.999+05:30');
  const after = before + 1;
  assert.equal(calendarDayKey(after) - calendarDayKey(before), 1);
  assert.equal(calendarDayStart(after), Date.parse('2026-10-23T00:00:00+05:30'));
  assert.strictEqual(projectCalendarTiming(meeting, before), meeting);
  assert.deepEqual(projectCalendarTiming(meeting, after), { ...meeting, daysLeft: -1, status: 'RECENT' });
  assert.equal(projectCalendarTiming(meeting, after).isDeclared, false, 'a past date is not proof of a declared result');
  assert.equal(projectCalendarTiming(meeting, after + 31 * 86400000).status, 'PAST');
});

test('cold boot restores more than 1000 durable meetings, keeps Oct 22 across rolling refresh, and keeps recovered rows through later outages', async context => {
  const cwd = process.cwd(), directory = fs.mkdtempSync(path.join(os.tmpdir(), 'calendar-recovery-'));
  const originalFetch = globalThis.fetch;
  const previousUrl = process.env.SUPABASE_URL, previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const initialNow = Date.parse('2026-10-23T01:00:00+05:30');
  context.mock.timers.enable({ apis: ['Date'], now: initialNow });
  const recentCodes = ['517354', '532209', '500830', '539254', '540767', '500104', '544285', '544282'];
  const stored = recentCodes.map((code, i) => {
    const meetingTimestamp = Date.parse('2026-10-22T00:00:00+05:30');
    const id = `${code}_${meetingTimestamp}_Results`;
    return { id, scrip_code: code, data: { id, symbol: code, scripCode: code,
      companyName: `Stored company ${i}`, purpose: 'Financial Results', meetingTimestamp,
      meetingDate: '22 Oct 2026', daysLeft: 0, status: 'TODAY', updatedAt: '2026-10-22T12:00:00Z' } };
  });
  // Synthetic older source records exercise the real DAO beyond the default 1000-row ceiling.
  for (let i = 0; i < 1101; i++) {
    const meetingTimestamp = Date.parse('2019-01-01T00:00:00+05:30') + i * 86400000;
    const id = `500325_${meetingTimestamp}_Results`;
    stored.push({ id, scrip_code: '500325', data: { id, symbol: 'RELIANCE', scripCode: '500325', companyName: 'Reliance',
      purpose: 'Financial Results', meetingTimestamp, meetingDate: new Date(meetingTimestamp).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }),
      daysLeft: -1, status: 'RECENT', updatedAt: '2026-10-22T12:00:00Z' } });
  }
  const cancelled = Date.parse('2026-10-24T00:00:00+05:30');
  stored.push({ id: 'old-future', scrip_code: '500325', data: { id: 'old-future', symbol: 'RELIANCE', scripCode: '500325', companyName: 'Reliance',
    purpose: 'Financial Results', meetingTimestamp: cancelled, meetingDate: '24 Oct 2026', daysLeft: 2, status: 'UPCOMING', updatedAt: '2026-10-22T12:00:00Z' } });
  stored.sort((a, b) => a.id.localeCompare(b.id));
  const pageReads: string[] = [];
  let unavailable = false;
  try {
    process.chdir(directory);
    fs.mkdirSync('data');
    fs.writeFileSync('data/settings.json', JSON.stringify({ autoTelegramCalendar: false }));
    process.env.SUPABASE_URL = 'https://calendar-recovery.invalid';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
    globalThis.fetch = async (input: any, init?: RequestInit) => {
      const url = new URL(String(input?.url || input));
      if (url.origin === 'https://calendar-recovery.invalid') {
        const table = url.pathname.split('/').at(-1);
        const method = init?.method || input?.method || 'GET';
        if (table === 'results_calendar' && method === 'GET') {
          if (unavailable) return Response.json({ message: 'Unavailable' }, { status: 503 });
          const after = (url.searchParams.get('id') || '').replace(/^gt\./, '');
          const limit = Number(url.searchParams.get('limit') || 1000);
          if (url.searchParams.has('limit')) pageReads.push(after);
          return Response.json(stored.filter(row => row.id > after).slice(0, limit));
        }
        if (table === 'settings') return Response.json({ key: 'global', value: { autoTelegramCalendar: false } });
        return Response.json([]);
      }
      assert.equal(url.hostname, 'api.bseindia.com', 'no real external request or notification is permitted');
      if (unavailable) return new Response('Unavailable', { status: 503 });
      return Response.json({ Table: url.searchParams.get('scripcode') === '500325' ? [
        { SCRIP_CD: '500325', Purpose_name: 'Financial Results', meeting_date: '26 Oct 2026', LONG_NAME: 'Reliance Industries Ltd' },
      ] : [] });
    };
    const service = await import('../services/resultsCalendarService.js');
    const first = await service.getResultsCalendarSnapshot();
    assert.equal(first.items.filter(item => item.meetingDate === '22 Oct 2026').length, 8);
    assert.equal(first.items.filter(item => item.meetingDate === '22 Oct 2026').every(item => item.daysLeft === -1 && item.status === 'RECENT'), true);
    assert.equal(first.items.find(item => item.scripCode === '517354')?.isDeclared, false);
    assert.equal(first.items.some(item => item.id === 'old-future'), false, 'a cancelled future date must be replaced');
    assert.equal(first.items.some(item => item.meetingDate === '26 Oct 2026'), true);
    assert.equal(first.items.length, 1110, 'all stored archive rows plus the current future schedule survive');
    assert.equal(pageReads.length, 3, 'the real DAO must fetch every stored page');
    const all = await service.getResultsCalendarData('recent', undefined, 'guest', 'all');
    assert.equal(all.items.filter(item => item.meetingDate === '22 Oct 2026').length, 7, 'All preserves the original F&O union watchlist membership');
    await service.fetchAndSyncResultsCalendar(true);
    assert.equal(service.readCachedResultsCalendar().items.filter(item => item.meetingDate === '22 Oct 2026').length, 8);
    unavailable = true;
    context.mock.timers.setTime(initialNow + 61000);
    const failed = await service.getResultsCalendarData('recent', undefined, 'guest', 'all');
    // Egress round 3: durable history is recovered once at boot and later
    // snapshots never re-read the store, so a post-recovery outage neither
    // erases rows nor reports the recovered history as unavailable. The
    // outage flag still surfaces while boot recovery has not succeeded.
    assert.equal(failed.calendarHistoryUnavailable, false);
    assert.equal(failed.items.filter(item => item.meetingDate === '22 Oct 2026').length, 7);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    process.chdir(cwd);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
