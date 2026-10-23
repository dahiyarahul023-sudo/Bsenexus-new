import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ADR_COMPANIES, adrCompanyFor, adrSeverity, readAdrSnapshot, type AdrSnapshot } from '../../src/shared/adr.js';
import { adrFromChart, createAdrService, regularCloseAt } from '../services/adrService.js';
import { adrMorningDate, buildAdrDigest, createAdrAlertWorker, isAdrMorning } from '../services/adrAlerts.js';
import { createAdrClient } from '../../src/services/adrClient.js';
import { OvernightAdrView } from '../../src/components/adr/OvernightAdr.js';
import { buildStoryChapters } from '../../src/components/story/storyBuilder.js';

const now = Date.parse('2026-10-22T02:45:00Z'); // 08:15 IST Thursday
const chart = (symbol = 'INFY', previousClose = 100, close = 105) => ({ meta: {
  symbol, currency: 'USD', exchangeName: 'NYQ', exchangeTimezoneName: 'America/New_York',
  currentTradingPeriod: { regular: { end: new Date('2026-10-21T20:00:00Z') } },
}, quotes: [
  { date: new Date('2026-10-20T13:30:00Z'), close: previousClose, volume: 100000 },
  { date: new Date('2026-10-21T13:30:00Z'), close, volume: 150000 },
], events: { splits: [] } });
const snapshot = (change = 5): AdrSnapshot => readAdrSnapshot({ checkedAt: now, items: ADR_COMPANIES.map(company => adrFromChart(company, chart(company.adrSymbol, 100, company.symbol === 'INFY' ? 100 + change : 101), now)) }, now)!;
const user = { uid: 'owner-a', notificationPreferences: { adrAlertsEnabled: true } };
const lists = [{ is_active: 1, items: [{ symbol: 'INFY', scripCode: '500209', priority: 'HIGH' }] }];

test('ADR adapter uses actual completed closes and exact USD/company identity', () => {
  const quote = adrFromChart(ADR_COMPANIES[0], chart(), now)!;
  assert.equal(quote.close, 105); assert.equal(quote.previousClose, 100);
  assert.ok(Math.abs(quote.changePercent - 5) < 1e-9);
  assert.equal(quote.sessionDate, '2026-10-21'); assert.equal(quote.source, 'Yahoo Finance');
  assert.equal(quote.sessionCloseAt, Date.parse('2026-10-21T20:00:00Z'));
  for (const meta of [{ currency: 'INR' }, { symbol: 'WRONG' }, { exchangeName: 'NMS' }, { exchangeTimezoneName: 'UTC' }]) {
    const data = chart(); Object.assign(data.meta, meta);
    assert.equal(adrFromChart(ADR_COMPANIES[0], data, now), null);
  }
  assert.equal(adrCompanyFor('INFY', '500180')?.symbol, 'HDFCBANK');
  const malformed = snapshot(); malformed.items[0].adrSymbol = 'HDB';
  assert.equal(readAdrSnapshot(malformed, now)!.items.length, 4);
});

test('an open US session never replaces the previous completed regular session', () => {
  const current = chart();
  current.meta.currentTradingPeriod.regular.end = new Date('2026-10-22T20:00:00Z');
  current.quotes.push({ date: new Date('2026-10-22T13:30:00Z'), close: 130, volume: 500000 });
  const quote = adrFromChart(ADR_COMPANIES[0], current, Date.parse('2026-10-22T16:00:00Z'))!;
  assert.equal(quote.sessionDate, '2026-10-21'); assert.equal(quote.close, 105);
  // A provider's after-hours last price is irrelevant to daily regular-session bars.
  (current.meta as any).postMarketPrice = 999;
  assert.equal(adrFromChart(ADR_COMPANIES[0], current, now)!.close, 105);
});

test('DST and a provider-confirmed early close are handled without a fixed IST close', () => {
  assert.equal(regularCloseAt('2026-07-08'), Date.parse('2026-07-08T20:00:00Z'));
  assert.equal(regularCloseAt('2026-12-08'), Date.parse('2026-12-08T21:00:00Z'));
  const early = chart();
  early.meta.currentTradingPeriod.regular.end = new Date('2026-11-27T18:00:00Z');
  early.quotes[0].date = new Date('2026-11-25T14:30:00Z');
  early.quotes[1].date = new Date('2026-11-27T14:30:00Z');
  assert.equal(adrFromChart(ADR_COMPANIES[0], early, Date.parse('2026-11-27T18:20:00Z'))!.sessionCloseAt, Date.parse('2026-11-27T18:00:00Z'));
});

test('zero/missing prices and volume are omitted; splits are marked rather than alerted', () => {
  for (const value of [0, NaN, undefined]) {
    const data = chart(); data.quotes[1].close = value as number;
    assert.equal(adrFromChart(ADR_COMPANIES[0], data, now), null);
  }
  const data = chart('INFY', 100, 50);
  (data.events.splits as any[]).push({ date: new Date('2026-10-21T13:30:00Z'), numerator: 2, denominator: 1 });
  const quote = adrFromChart(ADR_COMPANIES[0], data, now)!;
  assert.equal(quote.corporateAction, true);
  const feed = snapshot(); feed.items[0] = quote;
  assert.equal(buildAdrDigest(feed, user, lists, now), null);
  const thin = snapshot(); thin.items[0].volume = 20;
  assert.equal(buildAdrDigest(thin, user, lists, now), null);
});

test('service coalesces callers, reports partial coverage and retains the original check time on outage', async () => {
  let time = now; let calls = 0; let fail = false;
  const service = createAdrService(async symbol => { calls++; if (fail) throw Error('unavailable'); return chart(symbol); }, () => time);
  const [first, second] = await Promise.all([service.load(), service.load()]);
  assert.equal(calls, 5); assert.equal(first.status, 'ready'); assert.deepEqual(first, second);
  time += 301000; fail = true;
  const stale = await service.load(); assert.equal(stale.checkedAt, now); assert.equal(stale.items.length, 5); assert.equal(stale.refreshFailed, true);
  const partial = await createAdrService(async symbol => { if (symbol === 'WIT') throw Error('missing'); return chart(symbol); }, () => now).load();
  assert.equal(partial.status, 'partial'); assert.deepEqual(partial.unavailableSymbols, ['WIT']);
  const empty = await createAdrService(async () => { throw Error('offline'); }, () => now).load();
  assert.equal(empty.status, 'unavailable'); assert.deepEqual(empty.items, []);
});

test('an unavailable or partial ADR batch retries after one minute and recovers without losing single-flight behavior', async () => {
  let time = now, calls = 0, outage = true;
  const service = createAdrService(async symbol => { calls++; if (outage) throw Error('timeout'); return chart(symbol); }, () => time);
  assert.equal((await service.load()).status, 'unavailable');
  await service.load(); assert.equal(calls, 5, 'unavailable requests are backed off');
  time += 60001; outage = false;
  const [first, second] = await Promise.all([service.load(), service.load()]);
  assert.equal(first.status, 'ready'); assert.deepEqual(first, second); assert.equal(calls, 10);
});

test('repeated provider failures back off exponentially instead of hammering every minute', async () => {
  let time = now, calls = 0;
  const service = createAdrService(async () => { calls++; throw Error('429'); }, () => time);
  await service.load(); assert.equal(calls, 5);
  time += 60001; await service.load(); assert.equal(calls, 10);
  time += 60001; await service.load(); assert.equal(calls, 10);
  time += 60001; await service.load(); assert.equal(calls, 15);
});

test('public client validates responses, shares reads and retains useful data on failure', async () => {
  let time = now; let calls = 0; let fail = false;
  const client = createAdrClient(async () => { calls++; if (fail) throw Error('offline'); return snapshot(); }, () => time);
  await Promise.all([client.load(), client.load()]); assert.equal(calls, 1);
  time += 61000; fail = true;
  assert.equal((await client.load()).refreshFailed, true); assert.equal(client.peek()!.items.length, 5);
  const malformed = createAdrClient(async () => ({ checkedAt: now, items: [{ close: 0 }] }), () => now);
  await assert.rejects(malformed.load()); assert.equal(malformed.peek(), null);
});

test('partial refresh retains valid missing symbols and restart hydrates saved evidence without claiming freshness', async () => {
  let time = now, partial = false; let saved: AdrSnapshot | null = null;
  const storage = { read: async () => saved, save: async (value: AdrSnapshot) => { saved = value; } };
  const service = createAdrService(async symbol => { if (partial && symbol === 'WIT') throw Error('timeout'); return chart(symbol); }, () => time, storage);
  await service.load(); time += 301000; partial = true;
  const result = await service.load();
  assert.equal(result.items.length, 5); assert.equal(result.refreshFailed, true); assert.equal(result.checkedAt, now);
  const cold = createAdrService(async () => { throw Error('provider rate limit'); }, () => time, storage);
  const restored = await cold.load();
  assert.equal(restored.items.length, 5); assert.equal(restored.refreshFailed, true);
  assert.equal(buildAdrDigest(restored, user, lists, time), null);
  const expired = createAdrService(async () => { throw Error('offline'); }, () => time + 8 * 86400000, storage);
  assert.equal((await expired.load()).items.length, 0);
});

test('browser reload restores a public saved snapshot, handles denied storage, and rejects expired evidence', async () => {
  let saved: unknown = snapshot();
  const storage = { read: () => saved, save: (value: AdrSnapshot) => { saved = value; } };
  const restored = createAdrClient(async () => { throw Error('503'); }, () => now, storage);
  assert.equal(restored.peek()!.items.length, 5); assert.equal(restored.peek()!.refreshFailed, true);
  assert.equal((await restored.load()).refreshFailed, true);
  const expired = createAdrClient(async () => { throw Error('503'); }, () => now + 8 * 86400000, storage);
  assert.equal(expired.peek(), null); await assert.rejects(expired.load());
  const denied = createAdrClient(async () => snapshot(), () => now, { read() { throw Error('denied'); }, save() { throw Error('quota'); } });
  assert.equal((await denied.load()).items.length, 5);
});

test('an older successful source/API session cannot downgrade saved quotes or reconfirm them', async () => {
  const saved = snapshot();
  const olderChart = (symbol: string) => {
    const value = chart(symbol);
    value.meta.currentTradingPeriod.regular.end = new Date('2026-10-20T20:00:00Z');
    value.quotes.forEach(row => { row.date = new Date(row.date.getTime() - 86400000); });
    return value;
  };
  const service = createAdrService(async symbol => olderChart(symbol), () => now, { read: async () => saved, save: async () => {} });
  const restored = await service.load();
  assert.equal(restored.items[0].sessionDate, '2026-10-21'); assert.equal(restored.refreshFailed, true);
  const old = readAdrSnapshot({ checkedAt: now, items: ADR_COMPANIES.map(company => adrFromChart(company, olderChart(company.adrSymbol), now)) }, now)!;
  const client = createAdrClient(async () => old, () => now, { read: () => saved, save() {} });
  const result = await client.load();
  assert.equal(result.items[0].sessionDate, '2026-10-21'); assert.equal(result.refreshFailed, true);
});

test('daily Home and Story use the same values, one existing chapter, and exact company actions', () => {
  const data = snapshot(-5.25);
  const html = renderToStaticMarkup(React.createElement(OvernightAdrView, { snapshot: data, watched: ['500209'], now, onOpenCompany() {} }));
  assert.match(html, /Overnight ADR/); assert.match(html, /−5.25%/); assert.match(html, /Sharp US move/); assert.match(html, /Your watchlist/);
  assert.match(html, /View all 5/); assert.match(html, /21 Oct 2026 US close/); assert.doesNotMatch(html, /<svg[^>]*>.*<rect[^>]+height="5\.25"/);
  const chapters = buildStoryChapters({ timestamp: now, adr: data }, now);
  assert.equal(chapters.length, 1); assert.equal(chapters[0].id, 'market-pulse'); assert.equal(chapters[0].slides.length, 1);
  const slide = chapters[0].slides[0]; assert.equal(slide.layout, 'list');
  if (slide.layout === 'list') { assert.equal(slide.items.length, 3); assert.equal(slide.items[0].value, '−5.25%'); assert.equal(slide.items[0].company!.scripCode, '500209'); }
  assert.equal(slide.subject.kind, 'topic');
});

test('stale checks lose Home prominence and do not become fresh ADR stories or alerts', () => {
  const data = snapshot(); data.checkedAt = now - 11 * 60000;
  const html = renderToStaticMarkup(React.createElement(OvernightAdrView, { snapshot: data, now, onOpenCompany() {} }));
  assert.match(html, /Saved snapshot/); assert.match(html, /data-prominent="false"/); assert.doesNotMatch(html, /Sharp US move/);
  assert.deepEqual(buildStoryChapters({ timestamp: now, adr: data }, now), []);
  assert.equal(buildAdrDigest(data, user, lists, now), null);
  data.checkedAt = now; data.refreshFailed = true;
  assert.deepEqual(buildStoryChapters({ timestamp: now, adr: data }, now), []);
  assert.equal(buildAdrDigest(data, user, lists, now), null);
});

test('morning watchlist digest is opt-in, private, exact-match, priority/mute-aware and stable per US session', () => {
  const data = snapshot(); const notification = buildAdrDigest(data, user, lists, now)!;
  assert.equal(notification.userId, 'owner-a'); assert.equal(notification.scripCode, '500209'); assert.equal(notification.isWatchlist, true);
  assert.equal(notification.timestamp, now);
  assert.equal(notification.metadata!.sessionCloseAt, Date.parse('2026-10-21T20:00:00Z'));
  assert.equal(buildAdrDigest(data, user, lists, now + 60000)!.id, notification.id);
  assert.notEqual(buildAdrDigest(data, { ...user, uid: 'owner-b' }, lists, now)!.id, notification.id);
  for (const candidate of [
    { ...user, uid: 'guest' }, { ...user, muteInAppNotifications: true }, { ...user, notificationPreferences: {} },
    { ...user, notificationPreferences: { adrAlertsEnabled: false } },
    { ...user, notificationPreferences: { adrAlertsEnabled: true, muteInAppNotifications: true } },
    { ...user, notificationPreferences: { adrAlertsEnabled: true, stocksHighPriority: false } },
  ]) assert.equal(buildAdrDigest(data, candidate, lists, now), null);
  assert.equal(buildAdrDigest(data, user, [{ is_active: 0, items: lists[0].items }], now), null);
  assert.equal(buildAdrDigest(data, user, [{ is_active: 1, items: [{ symbol: 'INFY', scripCode: '500180' }] }], now), null);
  assert.equal(buildAdrDigest(data, user, [{ is_active: 1, items: [{ symbol: 'INFY', priority: 'LOW' }] }], now), null);
  assert.equal(buildAdrDigest(snapshot(3.99), user, lists, now), null);
  assert.equal(adrSeverity(-4), 'large'); assert.equal(adrSeverity(5), 'sharp');
});

test('weekends and non-morning calls do no recipient work; next Monday can use the last Friday session', async () => {
  assert.equal(isAdrMorning(Date.parse('2026-10-24T02:45:00Z')), false);
  assert.equal(isAdrMorning(Date.parse('2026-10-22T04:00:00Z')), false);
  assert.equal(isAdrMorning(now), true);
  let reads = 0;
  const worker = createAdrAlertWorker({ enabled: async () => true, snapshot: async () => { reads++; return snapshot(); }, users: async () => [user], recipient: async () => ({ user, lists }), save: async () => true, now: () => Date.parse('2026-10-24T02:45:00Z') });
  await worker(); assert.equal(reads, 0);
  const monday = Date.parse('2026-10-26T02:45:00Z');
  const feed = snapshot(); feed.checkedAt = monday;
  feed.items.forEach(item => { item.previousSessionDate = '2026-10-22'; item.sessionDate = '2026-10-23'; item.sessionCloseAt = Date.parse('2026-10-23T20:00:00Z'); });
  assert.ok(buildAdrDigest(feed, user, lists, monday));
  const tuesday = Date.parse('2026-10-27T02:45:00Z'); feed.checkedAt = tuesday;
  assert.equal(buildAdrDigest(feed, user, lists, tuesday), null);
  assert.equal(adrMorningDate(Date.parse('2026-11-27T18:00:00Z')), '2026-11-30');
});

test('overlapping workers recheck the owner and cannot authorize a different owner or failed membership read', async () => {
  let reads = 0; const saved: string[] = [];
  const worker = createAdrAlertWorker({ enabled: async () => true, snapshot: async () => snapshot(), users: async () => [user, { ...user, uid: 'owner-b' }],
    recipient: async uid => { reads++; if (uid === 'owner-b') throw Error('durable membership unavailable'); return { user, lists }; },
    save: async notification => { saved.push(notification.id); return true; }, now: () => now });
  await Promise.all([worker(), worker()]); assert.equal(reads, 2); assert.equal(saved.length, 1);
  const wrongOwner = createAdrAlertWorker({ enabled: async () => true, snapshot: async () => snapshot(), users: async () => [user], recipient: async () => ({ user: { ...user, uid: 'owner-b' }, lists }), save: async () => { assert.fail('Wrong owner notified'); }, now: () => now });
  await wrongOwner();
});
