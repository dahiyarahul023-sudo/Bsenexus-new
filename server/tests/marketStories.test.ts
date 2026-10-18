import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildStoryChapters, getStoryDuration, resolveStorySelection, safeStoryUrl, storyCash, storyTextPages } from '../../src/components/story/storyBuilder.js';
import { createStoryFeedClient } from '../../src/components/story/storyFeedClient.js';
import { StorySlideView } from '../../src/components/story/StorySlideView.js';
import { storyChartScale } from '../../src/components/story/StoryChart.js';
import type { StoryChartData } from '../../src/components/story/storyTypes.js';

const now = Date.parse('2026-10-16T12:00:00Z');
const feed = (extra: Record<string, unknown> = {}) => ({ timestamp: now, ...extra });
const company = { companyName: 'Example Engineering Ltd', symbol: 'EXAMPLE', scripCode: '000001' };
const filing = (id: string, extra: Record<string, unknown> = {}) => ({ ...company, id, headline: `Example Engineering wins order ${id}`, timestamp: now - 60_000, attachmentUrl: 'https://www.bseindia.com/xml-data/corpfiling/AttachLive/test.pdf', ...extra });
const flow = { fiiNet: -1100.25, diiNet: 2400.75, fiiBuy: 10000, fiiSell: 11100.25, diiBuy: 14400.75, diiSell: 12000, dateStr: '16-Oct-2026' };

test('an empty feed has no template market numbers and malformed freshness is rejected', () => {
  assert.deepEqual(buildStoryChapters(feed(), now), []);
  for (const value of [{}, null, feed({ timestamp: 'today' }), feed({ timestamp: now - 19 * 3600000 })]) assert.throws(() => buildStoryChapters(value, now));
  assert.deepEqual(buildStoryChapters(feed({ indices: { sensex: { price: 0, changePercent: 1 } }, fiiDii: { fiiNet: null, diiNet: 0 }, movers: {} }), now), []);
});

test('FII/DII net and gross pages are neutral topics with no company logo or company action', () => {
  const chapters = buildStoryChapters(feed({ fiiDii: flow }), now);
  assert.equal(chapters[0].id, 'institutional-flows');
  assert.equal(chapters[0].slides.length, 2);
  for (const slide of chapters[0].slides) {
    assert.equal(slide.subject.kind, 'topic');
    assert.equal(slide.source.dateLabel, flow.dateStr);
    const html = renderToStaticMarkup(React.createElement(StorySlideView, { slide, onOpenCompany() { assert.fail('Aggregate opened a company'); }, onInspectChange() {} }));
    assert.doesNotMatch(html, /<img|HDFC|SBI|500180|500112|Company 360/);
    assert.match(html, /FII/); assert.match(html, /DII/);
  }
  assert.match(chapters[0].slides[0].summary!, /1,301/);
});

test('zero flows remain valid, missing gross values omit the second page and negative signs never double', () => {
  const slides = buildStoryChapters(feed({ fiiDii: { fiiNet: 0, diiNet: -500, dateStr: '16-Oct-2026' } }), now)[0].slides;
  assert.equal(slides.length, 1); assert.match(slides[0].summary!, /selling: −₹500/);
  assert.equal(storyCash(0), '₹0 Cr'); assert.equal(storyCash(-500), '−₹500 Cr');
});

test('chart uses one proportional signed scale and zero is the baseline, not a fake bar', () => {
  const chart: StoryChartData = { title: 'Scale test', unit: 'Cr', series: [{ label: 'Net' }], points: [{ label: 'A', values: [200] }, { label: 'B', values: [-100] }] };
  const scale = storyChartScale(chart);
  assert.ok(Math.abs((scale.zero - scale.y(200)) / (scale.y(-100) - scale.zero) - 2) < 1e-9);
  assert.equal(scale.y(0), scale.zero);
  assert.ok(Number.isFinite(storyChartScale({ ...chart, points: [{ label: 'A', values: [0] }] }).zero));
});

test('calendar pages expand with data, dedupe records, and never invent stock codes', () => {
  const meetings = Array.from({ length: 8 }, (_, i) => ({ id: `${i}`, companyName: `Company ${i}`, symbol: `C${i}`, meetingDate: `2026-10-${20 + i}`, purpose: 'Financial results', daysLeft: i + 1 }));
  const chapter = buildStoryChapters(feed({ resultsCalendar: { todayMeetings: [], upcomingMeetings: [...meetings, meetings[0]] } }), now)[0];
  assert.equal(chapter.slides.length, 3);
  assert.deepEqual(chapter.slides.map(s => s.layout === 'list' ? s.items.length : -1), [3, 3, 2]);
  for (const slide of chapter.slides) if (slide.layout === 'list') assert.ok(slide.items.every(item => !item.company));
});

test('different company filings get separate pages; stale, future and duplicate records are omitted', () => {
  const items = [filing('a'), filing('b', { companyName: 'Another Company Ltd', scripCode: '000002', headline: 'Another Company opens a facility' }), filing('copy', { headline: 'Example Engineering wins order a' }), filing('old', { timestamp: now - 19 * 3600000 }), filing('future', { timestamp: now + 1000 })];
  const chapter = buildStoryChapters(feed({ fresh18hAnnouncements: items }), now)[0];
  assert.equal(chapter.slides.length, 2);
  assert.ok(chapter.slides.every(slide => slide.subject.kind === 'company'));
  assert.notEqual(chapter.slides[0].id, chapter.slides[1].id);
});

test('long copy spans screens without losing decimal financial facts or words', () => {
  const copy = 'Revenue rose 12.5% to ₹1,234.56 Cr. ' + 'The order includes equipment supply and installation. '.repeat(13);
  const pages = storyTextPages(copy);
  assert.ok(pages.length > 2);
  assert.equal(pages.join(' '), copy.trim());
  assert.ok(pages.every(page => page.split(/\s+/).length <= 38));
  const chapter = buildStoryChapters(feed({ fresh18hAnnouncements: [filing('long', { headline: copy })] }), now)[0];
  assert.equal(chapter.slides.length, 3);
  assert.match(chapter.slides[0].summary!, /12\.5%.*1,234\.56/);
  assert.ok(chapter.slides.every(slide => slide.source.url));
});

test('news sources remain publishers and do not inherit a neighbouring filing company', () => {
  const chapters = buildStoryChapters(feed({ fresh18hAnnouncements: [filing('a')], fresh18hNewsStories: [{ id: 'news', title: 'The market welcomes a policy change', snippet: 'The market welcomes a policy change. New rules were announced.', source: 'Original publisher', publishedAt: new Date(now - 30000).toISOString(), link: 'https://publisher.example/report' }] }), now);
  const lead = chapters[0].slides[0]; assert.equal(lead.subject.kind, 'topic');
  assert.equal(lead.summary, 'New rules were announced.'); assert.equal(lead.source.name, 'Original publisher');
});

test('market movers respect the existing session gate; chapter lookup does not depend on array positions', () => {
  const payload = feed({ movers: { topGainers: [{ ...company, name: company.companyName, price: 100, changePercent: 0 }] }, fiiDii: flow });
  assert.equal(buildStoryChapters(payload, now, false)[0].id, 'institutional-flows');
  const chapter = buildStoryChapters(payload, now, true).find(chapter => chapter.id === 'market-pulse')!;
  assert.equal(chapter.slides[0].layout, 'list');
  if (chapter.slides[0].layout === 'list') assert.equal(chapter.slides[0].items[0].value, '0.00%');
});

test('source URLs reject script, insecure, credential-bearing and relative links', () => {
  for (const value of ['javascript:alert(1)', 'http://publisher.example', 'https://user:pass@publisher.example', '/fake', null]) assert.equal(safeStoryUrl(value), undefined);
  assert.equal(safeStoryUrl('https://publisher.example/article?a=1&b=2'), 'https://publisher.example/article?a=1&b=2');
});

test('reading duration grows with actual content, within a bounded range', () => {
  const slide = buildStoryChapters(feed({ fresh18hAnnouncements: [filing('a')] }), now)[0].slides[0];
  assert.ok(getStoryDuration({ ...slide, summary: 'word '.repeat(38) }) > getStoryDuration(slide));
  assert.ok(getStoryDuration(slide) >= 7000); assert.ok(getStoryDuration({ ...slide, summary: 'word '.repeat(1000) }) <= 18000);
  const list = { ...slide, layout: 'list' as const, items: [{ id: 'a', label: 'One company', detail: 'Board meeting' }] };
  assert.ok(getStoryDuration({ ...list, items: [{ ...list.items[0], detail: 'Financial results and dividend discussion '.repeat(7) }] }) > getStoryDuration(list));
});

test('public client coalesces reads, expires cache, and never turns a failure into demo data', async () => {
  let time = now; let calls = 0; let fail = false;
  const client = createStoryFeedClient({ now: () => time, session: () => ({ storySessionId: 'a', showMarketMoves: true }), request: async () => { calls++; if (fail) throw new Error('offline'); return feed({ fiiDii: flow, timestamp: time }); } });
  assert.deepEqual(client.peek(), []);
  await Promise.all([client.load(), client.load()]); assert.equal(calls, 1);
  await client.load(); assert.equal(calls, 1);
  fail = true; await assert.rejects(client.load(true)); assert.equal(client.peek()[0].id, 'institutional-flows');
  time += 181000; assert.deepEqual(client.peek(), []); await assert.rejects(client.load());
});

test('a forced newer response wins an older response finishing late', async () => {
  const requests: ((value: unknown) => void)[] = [];
  const client = createStoryFeedClient({ now: () => now, session: () => ({ storySessionId: 'a', showMarketMoves: true }), request: () => new Promise(resolve => requests.push(resolve)) });
  const old = client.load(); await Promise.resolve(); const newer = client.load(true); await Promise.resolve();
  requests[1](feed({ fiiDii: { ...flow, fiiNet: 42 } })); await newer;
  requests[0](feed({ fiiDii: { ...flow, fiiNet: 999 } })); await old;
  const slide = client.peek()[0].slides[0]; assert.equal(slide.layout, 'chart');
  if (slide.layout === 'chart') assert.equal(slide.chart.points[0].values[0], 42);
});

test('cross-session cache does not leak yesterday’s presentation into a new edition', async () => {
  let session = 'a'; const client = createStoryFeedClient({ now: () => now, session: () => ({ storySessionId: session, showMarketMoves: true }), request: async () => feed({ fiiDii: flow }) });
  await client.load(); session = 'b'; assert.deepEqual(client.peek(), []);
});

test('a newly available requested topic wins the initial load, then refresh keeps the exact reading position', () => {
  const initial = buildStoryChapters(feed({ fresh18hAnnouncements: [filing('a')] }), now);
  const missing = resolveStorySelection(initial, '', 'institutional-flows');
  assert.equal(missing.missingTopic, true);
  const hydrated = buildStoryChapters(feed({ fresh18hAnnouncements: [filing('a')], fiiDii: flow }), now);
  const selected = resolveStorySelection(hydrated, missing.activeId, 'institutional-flows');
  assert.equal(selected.activeId, 'flows-net'); assert.equal(selected.missingTopic, false);
  assert.equal(resolveStorySelection(hydrated, 'flows-gross').activeId, 'flows-gross');
  assert.equal(resolveStorySelection([...hydrated].reverse(), 'flows-gross').activeId, 'flows-gross');
});
