import { test } from 'node:test';
import assert from 'node:assert/strict';
import { automaticCalendarMeetings } from '../services/calendarUniverse.js';

const now = Date.parse('2026-10-24T00:00:00+05:30');
const meeting = (date: string, changes: Record<string, unknown> = {}) => ({
  id: 'saved-row', scripCode: '500325', purpose: 'Financial Results',
  meetingTimestamp: Date.parse(date), daysLeft: 0, status: 'TODAY', ...changes,
});
const own = new Set(['500325']);

test('yesterday cannot be a Today alert after an Indian midnight or restart', context => {
  context.mock.timers.enable({ apis: ['Date'], now });
  assert.deepEqual(automaticCalendarMeetings([meeting('2026-10-23T00:00:00+05:30')], own, new Set()), []);
});

test('future meeting is reprojected from its date rather than stale saved status', context => {
  context.mock.timers.enable({ apis: ['Date'], now });
  const rows = automaticCalendarMeetings([meeting('2026-10-25T00:00:00+05:30', { daysLeft: -1, status: 'RECENT' })], own, new Set());
  assert.equal(rows.length, 1);
  assert.equal(rows[0].daysLeft, 1);
  assert.equal(rows[0].status, 'UPCOMING');
});

test('declared and invalid-date rows cannot become automatic pending-meeting alerts', context => {
  context.mock.timers.enable({ apis: ['Date'], now });
  for (const change of [{ isDeclared: true }, { meetingTimestamp: NaN }, { meetingTimestamp: 0 }]) {
    assert.deepEqual(automaticCalendarMeetings([meeting('2026-10-24T00:00:00+05:30', change)], own, new Set()), []);
  }
});

test('same-day candidates keep watchlist, already-notified and three-alert limits', context => {
  context.mock.timers.enable({ apis: ['Date'], now });
  const rows = Array.from({length: 5}, (_, i) => meeting('2026-10-24T00:00:00+05:30', {id: `event-${i}`}));
  assert.equal(automaticCalendarMeetings(rows, own, new Set()).length, 3);
  assert.deepEqual(automaticCalendarMeetings(rows, new Set(), new Set()), []);
  assert.deepEqual(automaticCalendarMeetings([rows[0]], own, new Set(['event-0'])), []);
});
