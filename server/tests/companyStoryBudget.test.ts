import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildStoryChapters } from '../../src/components/story/storyBuilder.js';
import { StoryChapterProgress } from '../../src/components/story/StoryChapterProgress.js';
import { StorySlideView } from '../../src/components/story/StorySlideView.js';

const now = Date.parse('2026-10-18T06:00:00Z');
function filing(id: string, company = 1, extra: Record<string, unknown> = {}) {
  return { id, scripCode: String(100000 + company), symbol: `C${company}`, companyName: `Company ${company} Ltd`, headline: `Company ${company} reports an update ${id}`, timestamp: now - 1000, attachmentUrl: `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${id}.pdf`, ...extra };
}
const stories = (items: unknown[]) => buildStoryChapters({ timestamp: now, fresh18hAnnouncements: items }, now).find(chapter => chapter.id === 'corporate-actions')!;

test('company news stays one chapter and never exceeds seven screens with a full feed', () => {
  const chapter = stories(Array.from({ length: 25 }, (_, i) => filing(`${i}`, i + 1)));
  assert.equal(chapter.id, 'corporate-actions'); assert.equal(chapter.title, 'Company news');
  assert.equal(chapter.slides.length, 7);
});

test('one busy company cannot occupy more than two screens', () => {
  const chapter = stories(Array.from({ length: 25 }, (_, i) => filing(`${i}`)));
  assert.ok(chapter.slides.length <= 2);
});

test('a generic update does not automatically receive a generic markets illustration', () => {
  const slides = stories([filing('a'), filing('b', 2), filing('c', 3)]).slides;
  assert.ok(slides.every(slide => slide.layout !== 'news' || slide.artwork === undefined));
});

test('a busy company stays contiguous while distinct companies get priority', () => {
  const chapter = stories([
    filing('a', 1, { timestamp: now - 1 }),
    filing('b', 2, { timestamp: now - 2 }),
    filing('c', 1, { timestamp: now - 3 }),
    filing('d', 3, { timestamp: now - 4 }),
    filing('e', 1, { timestamp: now - 5 }),
  ]);
  assert.deepEqual(chapter.slides.map(slide => slide.subject.kind === 'company' && slide.subject.company.scripCode), ['100001', '100001', '100002', '100003']);
  assert.deepEqual(chapter.slides.map(slide => slide.id), ['filing-a-0', 'filing-c-0', 'filing-b-0', 'filing-d-0']);
});

test('seven-screen budget keeps complete explanations and sparse feeds are not padded', () => {
  const twoPages = 'A detail from the original filing. '.repeat(8);
  const chapter = stories(Array.from({ length: 4 }, (_, i) => filing(`${i}`, i + 1, { snippet: twoPages })));
  assert.equal(chapter.slides.length, 6);
  for (let i = 0; i < 6; i += 2) assert.equal(chapter.slides[i].sequenceId, chapter.slides[i + 1].sequenceId);
  assert.equal(stories([filing('only')]).slides.length, 1);
});

test('long linked reports use two screens, and unlinked oversized copy is not silently cut', () => {
  const headline = 'Reported source detail. '.repeat(35);
  const chapter = stories([filing('linked', 1, { headline }), filing('unlinked', 2, { headline, attachmentUrl: undefined })]);
  assert.equal(chapter.slides.length, 2);
  assert.ok(chapter.slides.every(slide => slide.id.startsWith('filing-linked-') && slide.source.url));
});

test('artwork is relevant, restrained and absent from continuation pages', () => {
  const chapter = stories([
    filing('bank1', 1, { headline: 'Bank expands its deposit network', snippet: 'A source detail. '.repeat(16) }),
    filing('bank2', 2, { headline: 'Another bank opens a branch' }),
    filing('solar', 3, { headline: 'Company opens a solar facility' }),
    filing('pharma', 4, { headline: 'Pharma facility receives approval' }),
    filing('steel', 5, { headline: 'Steel plant expands capacity' }),
  ]);
  const illustrated = chapter.slides.filter(slide => slide.layout === 'news' && slide.artwork);
  assert.ok(illustrated.length <= 3);
  assert.equal(new Set(illustrated.map(slide => slide.layout === 'news' && slide.artwork)).size, illustrated.length);
  assert.ok(chapter.slides.every((slide, i, all) => {
    const previous = all[i - 1];
    return !(slide.layout === 'news' && slide.artwork && previous?.layout === 'news' && previous.artwork);
  }));
  const continuation = chapter.slides.find(slide => slide.id === 'filing-bank1-1')!;
  assert.equal(continuation.layout, 'news');
  assert.ok(continuation.layout === 'news' && !continuation.artwork);
});

test('clean text updates render without an illustration or an empty visual container', () => {
  const slide = stories([filing('text')]).slides[0];
  const html = renderToStaticMarkup(React.createElement(StorySlideView, { slide, onOpenCompany() {}, onInspectChange() {} }));
  assert.match(html, /Company 1 reports an update text/);
  assert.doesNotMatch(html, /story-artwork|<svg|<img/);
});

test('chapter progress never resets when the next company has a different sequence', () => {
  const chapter = stories(Array.from({ length: 7 }, (_, i) => filing(`${i}`, i + 1)));
  const html = renderToStaticMarkup(React.createElement(StoryChapterProgress, { chapter, activeId: chapter.slides[2].id, progress: 50 }));
  assert.match(html, /Company news, story 3 of 7/);
  assert.match(html, />3 \/ 7<\/span>/);
  assert.equal((html.match(/<i style=/g) || []).length, 7);
  assert.equal((html.match(/scaleX\(1\)/g) || []).length, 2);
  assert.equal((html.match(/scaleX\(0\.5\)/g) || []).length, 1);
  const end = renderToStaticMarkup(React.createElement(StoryChapterProgress, { chapter, activeId: chapter.slides[6].id, progress: 100 }));
  assert.match(end, />7 \/ 7<\/span>/);
});

test('a single explicitly awarded order amount becomes a metric without losing its qualifier or decimals', () => {
  for (const value of ['₹1,234.56 Cr', 'up to ₹1,234.56 crore']) {
    const slide = stories([filing('order', 1, { headline: `Company wins order worth ${value}` })]).slides[0];
    assert.equal(slide.layout, 'metric');
    if (slide.layout === 'metric') assert.equal(slide.metric.value, value);
    assert.equal(slide.title, 'Company wins order');
    assert.equal(slide.source.name, 'BSE filing');
  }
});

test('ambiguous, speculative, unrelated and multiple amounts never become order metrics', () => {
  for (const headline of [
    'Company wins ₹100 Cr order, revenue ₹200 Cr',
    'Company targets ₹100 Cr order',
    'Company receives ₹100 Cr loan for contract',
    'Company wins order as revenue reaches ₹100 Cr',
    'Company could win ₹100 Cr order',
    'Company not awarded ₹100 Cr contract',
  ]) assert.equal(stories([filing('ambiguous', 1, { headline })]).slides[0].layout, 'news');
});

test('exact named reports share the company budget without inheriting a company identity', () => {
  const chapter = buildStoryChapters({ timestamp: now,
    fresh18hAnnouncements: [filing('filing', 1, { timestamp: now - 4 })],
    fresh18hNewsStories: Array.from({ length: 3 }, (_, i) => ({ id: `report${i}`, companyName: 'Company 1 Ltd', title: `Named report ${i}`, publishedAt: now - i - 1, link: 'https://publisher.example/report' })),
  }, now).find(chapter => chapter.id === 'corporate-actions')!;
  assert.equal(chapter.slides.length, 2);
  assert.ok(chapter.slides.every(slide => slide.subject.kind === 'topic'));
});
