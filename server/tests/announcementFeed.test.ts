import test from 'node:test';
import assert from 'node:assert/strict';
import { announcementTs, mergeAnnouncementFeed, getAnnouncementFeedStatus } from '../../src/utils/announcementFeed';
import { parseFilingTimestamp } from '../../src/utils/timeFormat';

const now = Date.parse('2026-10-09T17:30:00Z');
const day = 86400000;
const filing = (id: string, age: number) => ({ id, bseTimestamp: now - age });

test('historical backfill stays below current filings on repeated refreshes', () => {
  const cached = [filing('latest', 1000), filing('earlier', 60000)];
  const incoming = [{ id: 'backfill', bseTime: '2026-10-03 17:08:00', fetched_at: now, bseTimestamp: now }];
  const merged = mergeAnnouncementFeed(cached, incoming, now);
  assert.deepEqual(merged.map(a => a.id), ['latest', 'earlier', 'backfill']);
  assert.equal(merged[2].bseTimestamp, Date.parse('2026-10-03T17:08:00+05:30'));
  assert.deepEqual(mergeAnnouncementFeed(merged, incoming, now), merged);
});

test('refresh applies corrected publication dates and fields without losing other current records', () => {
  const merged = mergeAnnouncementFeed([filing('a', 1000), { ...filing('b', 2000), subject: 'old', aiSummary: 'saved' }],
    [{ id: 'b', bseTime: '2026-10-09T17:29:59.500Z', subject: 'corrected' }], now);
  assert.deepEqual(merged.map(a => a.id), ['b', 'a']);
  assert.equal(merged[0].subject, 'corrected');
  assert.equal(merged[0].aiSummary, 'saved');
});

test('cache entry and subsequent refresh prune by exchange publication time, not ingestion time', () => {
  const cached = [{ id: 'expired', bseTime: '2026-10-01 23:28:00', fetched_at: now },
    filing('boundary', 7 * day), filing('too-old', 7 * day + 1), { id: 'unknown' }, filing('current', 1)];
  assert.deepEqual(mergeAnnouncementFeed([], cached, now).map(a => a.id), ['current', 'boundary', 'unknown']);
  assert.deepEqual(mergeAnnouncementFeed(cached, [], now).map(a => a.id), ['current', 'boundary', 'unknown']);
});

test('exchange timestamps share IST parsing with cards and support API date formats', () => {
  const expected = Date.parse('2026-10-09T20:35:00+05:30');
  for (const value of ['2026-10-09 20:35:00', '09/10/2026 08:35:00 PM', expected, String(expected), expected / 1000, `/Date(${expected})/`]) {
    assert.equal(parseFilingTimestamp(value), expected);
  }
  assert.equal(announcementTs({ bseTime: 'invalid', bseTimestamp: expected }), expected);
  assert.equal(announcementTs({ fetched_at: String(expected) }), expected);
  assert.equal(announcementTs({}), 0);
});

test('saved, failed, delayed, historical and empty feeds cannot claim a checked feed', () => {
  const base = { checked: true, error: null, blocked: false, staleAt: null, items: [filing('today', 1000)], now };
  assert.equal(getAnnouncementFeedStatus(base), 'checked');
  assert.equal(getAnnouncementFeedStatus({ ...base, checked: false }), 'checking');
  assert.equal(getAnnouncementFeedStatus({ ...base, error: 'HTTP 500' }), 'error');
  assert.equal(getAnnouncementFeedStatus({ ...base, blocked: true }), 'delayed');
  assert.equal(getAnnouncementFeedStatus({ ...base, staleAt: -1 }), 'delayed');
  assert.equal(getAnnouncementFeedStatus({ ...base, items: [filing('weekend', 2 * day)] }), 'historical');
  assert.equal(getAnnouncementFeedStatus({ ...base, items: [{ id: 'undated' }] }), 'historical');
  assert.equal(getAnnouncementFeedStatus({ ...base, items: [] }), 'empty');
  assert.equal(getAnnouncementFeedStatus({ ...base, error: 'offline', blocked: true }), 'error');
});
