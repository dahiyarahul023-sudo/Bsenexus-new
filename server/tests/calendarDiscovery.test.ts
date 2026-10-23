import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { selectCalendarMeetings } from '../ai/calendarRead.js';
import { renderPublicCalendarShell } from '../services/publicCalendar.js';
import { getGuidePrimaryAction } from '../services/marketGuidesService.js';
import type { ResultCalendarItem } from '../services/resultsCalendarService.js';

const now = Date.parse('2026-10-23T06:00:00Z');
const meeting = (scripCode: string, companyName = scripCode, symbol = scripCode): ResultCalendarItem => ({
  id: scripCode, scripCode, companyName, symbol, purpose: 'Financial results',
  meetingDate: '2026-10-23', meetingTimestamp: now, daysLeft: 0,
  status: 'TODAY', updatedAt: new Date(now).toISOString(),
});

test('numeric calendar cache labels use exact security-code identities without losing unknown names', () => {
  const items = [meeting('500228', '500228', 'INFY'), meeting('500387'), meeting('500420'), meeting('532149'),
    meeting('500034'), meeting('532977'), meeting('899999', 'Unlisted in master & still named', 'CUSTOM')];
  const snapshot = { items, lastUpdated: now };
  const before = JSON.stringify(snapshot);
  const result = selectCalendarMeetings(snapshot, { limit: 20 }, undefined, now);
  const names = new Map(result.meetings.map(m => [m.scripCode, m.companyName]));
  assert.equal(names.get('500228'), 'JSW STEEL LTD');
  assert.notEqual(result.meetings.find(m => m.scripCode === '500228')?.symbol, 'INFY');
  assert.equal(names.get('500387'), 'SHREE CEMENT LTD');
  assert.equal(names.get('500420'), 'TORRENT PHARMACEUTICALS LTD');
  assert.equal(names.get('532149'), 'BANK OF INDIA');
  assert.equal(names.get('500034'), 'Bajaj Finance Ltd');
  assert.equal(names.get('532977'), 'Bajaj Auto Ltd');
  assert.equal(names.get('899999'), 'Unlisted in master & still named');
  assert.equal(JSON.stringify(snapshot), before);
  const html = renderPublicCalendarShell(fs.readFileSync('index.html', 'utf8'), snapshot, now);
  assert.ok(html.includes('JSW STEEL LTD</h2>'));
  assert.ok(!html.includes('>500228</h2>'));
  assert.ok(html.includes('Unlisted in master &amp; still named'));
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
  assert.ok(schema.mainEntity.itemListElement.some((m: any) => m.name === 'JSW STEEL LTD — 2026-10-23'));
});

test('calendar guides lead to the calendar, while other guides preserve their existing primary destination', () => {
  for (const slug of ['bse-quarterly-results-calendar-guide', 'board-meeting-results-guide']) {
    const action = getGuidePrimaryAction(slug);
    assert.equal(action.href, '/results-calendar');
    assert.ok(action.description?.includes('scheduled'));
  }
  for (const slug of ['sebi-lodr-regulation-30', 'unknown', '"><script>alert(1)</script>']) {
    assert.deepEqual(getGuidePrimaryAction(slug), { href: '/?tab=guides', label: 'Open in Bsenexus App' });
  }
});
