import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HomeNewsFeed, readHomeNews, selectHomeNews, safeNewsUrl } from '../../src/utils/homeNews.ts';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createHash } from 'node:crypto';

const now = Date.parse('2026-10-09T12:00:00Z');
const item = (id: string, title = `Distinct company ${id} develops a new product`, hours = 1, category = 'corporate') => ({
  id, title, link: `https://publisher.example/story/${id}`, publishedAt: new Date(now - hours * 3_600_000).toISOString(), source: 'Publisher', snippet: 'Short excerpt', category,
});

test('fresh policy story leads; older high-impact news decays below relevant recent stories', () => {
  const policy = item('policy', 'RBI announces repo rate cut', 1, 'regulatory');
  const latest = item('latest', 'Company secures manufacturing contract', 0.1);
  assert.equal(selectHomeNews([latest, policy], [], now)[0].id, 'policy');
  assert.equal(selectHomeNews([latest, { ...policy, publishedAt: new Date(now - 40 * 3_600_000).toISOString() }], [], now)[0].id, 'latest');
});

test('exact watchlist match receives preference; partial symbols and unknown dates do not invent freshness', () => {
  const watched = item('watched', 'INFY announces a new partnership');
  const other = item('other', 'A software company announces a new partnership');
  assert.equal(selectHomeNews([other, watched], ['INFY'], now)[0].id, 'watched');
  const partial = item('partial', 'INFYTECH launches a product');
  assert.equal(selectHomeNews([partial, other], ['INFY'], now)[0].id, 'other');
  const unknown = { ...item('unknown', 'RBI announces repo rate cut'), publishedAt: '' };
  assert.equal(selectHomeNews([unknown, other], [], now)[0].id, 'other');
});

test('supporting cards suppress duplicate headlines and tracking variants, but preserve distinct events', () => {
  const lead = item('lead', 'RBI announces repo rate cut after policy meeting', 1, 'regulatory');
  const sameTitle = { ...item('duplicate'), title: lead.title };
  const sameLink = { ...item('link'), link: lead.link + '?utm_source=feed' };
  const selected = selectHomeNews([lead, sameTitle, sameLink, item('two'), item('three', 'Major exporter announces quarterly financial results', 1, 'earnings')], [], now);
  assert.equal(selected.length, 3);
  assert.ok(!selected.some(x => x.id === 'duplicate' || x.id === 'link'));
});

test('input accepts feed envelopes, rejects malformed payloads and unsafe/original-link fallbacks', () => {
  assert.equal(safeNewsUrl('javascript:alert(1)'), null);
  assert.equal(safeNewsUrl('https://user:pass@publisher.example/news'), null);
  assert.throws(() => readHomeNews({ success: true }), /Invalid/);
  assert.throws(() => readHomeNews({ success: false, items: [] }), /unavailable/);
  assert.equal(readHomeNews({ items: [{ ...item('a'), hasArticleLink: false }, { ...item('b'), link: 'javascript:alert(1)' }] }).length, 0);
  assert.equal(readHomeNews({ items: [{ ...item('a'), publicationTimeKnown: false }] })[0].publishedAt, '');
});

test('background refresh queues changes; accept is explicit; failure/empty refresh preserves visible cards', async () => {
  const feed = new HomeNewsFeed();
  const choose = (items: any[]) => selectHomeNews(items, [], now);
  await feed.refresh(async () => [item('one')], choose);
  await feed.refresh(async () => [item('two')], choose);
  assert.equal(feed.getSnapshot().displayed[0].id, 'one');
  assert.equal(feed.getSnapshot().pending?.[0].id, 'two');
  feed.accept(); assert.equal(feed.getSnapshot().displayed[0].id, 'two');
  await feed.refresh(async () => { throw new Error('offline'); }, choose);
  assert.equal(feed.getSnapshot().error, true);
  assert.equal(feed.getSnapshot().displayed[0].id, 'two');
  await feed.refresh(async () => [], choose);
  assert.equal(feed.getSnapshot().displayed[0].id, 'two');
});

test('cancel fences an ignored-abort late response and prevents overlapping requests', async () => {
  const feed = new HomeNewsFeed(); let resolve!: (value: unknown) => void;
  let count = 0; let signal!: AbortSignal;
  const first = feed.refresh(s => { count++; signal = s; return new Promise(r => { resolve = r; }); }, x => x);
  await feed.refresh(async () => { count++; return [item('overlap')]; }, x => x);
  assert.equal(count, 1);
  feed.cancel(); assert.equal(signal.aborted, true);
  await feed.refresh(async () => [item('new')], x => x);
  resolve([item('old')]); await first;
  assert.equal(feed.getSnapshot().displayed[0].id, 'new');
  assert.equal(feed.getSnapshot().pending, null);
});

test('empty successful initial load and unchanged snapshot do not create a false update banner', async () => {
  const feed = new HomeNewsFeed();
  await feed.refresh(async () => [], x => x);
  assert.equal(feed.getSnapshot().error, false);
  assert.ok(feed.getSnapshot().checkedAt);
  await feed.refresh(async () => [item('a')], x => x);
  await feed.refresh(async () => [item('a')], x => x);
  assert.equal(feed.getSnapshot().pending, null);
});

test('RSS provenance distinguishes missing publication date and search fallback from original article', async () => {
  const { newsPublicationTime } = await import('../utils/newsPublicationTime.js');
  const source = readFileSync(new URL('../services/stockNewsService.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source + '\nexports.testParse = parseRssFeedXml;', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  vm.runInNewContext(code, { exports, console, require(path: string) {
    if (path === 'crypto') return { createHash };
    if (path.endsWith('localStore.js')) return { readLocalJson: () => ({}) };
    if (path.endsWith('supabase.js')) return { isSupabaseConfigured: () => false };
    if (path.endsWith('newsPublicationTime.js')) return { newsPublicationTime };
    return {};
  } });
  const rows = exports.testParse('<rss><item><title>Company announces significant results</title><link>https://publisher.example/a</link></item><item><title>A second headline without a link</title><pubDate>Fri, 09 Oct 2026 12:00:00 GMT</pubDate></item></rss>', { name: 'Publisher', slug: 'test', category: 'market' });
  assert.equal(rows[0].publicationTimeKnown, false);
  assert.equal(rows[0].hasArticleLink, true);
  assert.equal(rows[1].publicationTimeKnown, true);
  assert.equal(rows[1].hasArticleLink, false);
  assert.equal(readHomeNews(rows).length, 1);
  assert.equal(readHomeNews(rows)[0].publishedAt, '');
});


test('actual text card renders full long headline, original link and honest unknown time without images', () => {
  const source = readFileSync(new URL('../../src/components/HomeMarketNews.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const actualRequire = createRequire(new URL('../../src/components/HomeMarketNews.tsx', import.meta.url));
  const { NoteEditorProvider } = actualRequire('../context/NoteEditorContext');
  const exports: any = {};
  vm.runInNewContext(code, { exports, console, require(path: string) {
    if (path.endsWith('homeNews')) return { safeNewsUrl };
    if (path.startsWith('../')) return {};
    return actualRequire(path);
  } });
  const title = 'A very long company headline '.repeat(12).trim();
  const html = renderToStaticMarkup(React.createElement(NoteEditorProvider, null, React.createElement(exports.NewsTextCard, { item: { ...item('render'), title, publishedAt: '' }, lead: true })));
  assert.ok(html.includes(title));
  assert.ok(html.includes('href="https://publisher.example/story/render"'));
  assert.ok(html.includes('Publication time unavailable'));
  assert.ok(html.includes('read original at Publisher'));
  assert.equal((html.match(/<button\b/g) || []).length, 2);
  assert.ok(!html.includes('home-news-read'));
  assert.ok(html.includes('Save note'));
  assert.ok(html.includes('Share article'));
  assert.ok(html.startsWith('<article'));
  assert.ok(!/<a[^>]*>[^<]*<button/.test(html));
  assert.ok(html.includes('noopener noreferrer'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<time'));
  assert.equal(renderToStaticMarkup(React.createElement(exports.NewsTextCard, { item: { ...item('unsafe'), link: 'javascript:alert(1)' } })), '');
});

test('full news card exposes only AI, share and notes while headline opens the article', () => {
  const source = readFileSync(new URL('../../src/components/NewsPortal.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source + '\nexports.testCard = NewsCardItem;', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const actualRequire = createRequire(new URL('../../src/components/NewsPortal.tsx', import.meta.url));
  const { NoteEditorProvider } = actualRequire('../context/NoteEditorContext');
  const exports: any = {};
  vm.runInNewContext(code, { exports, console, require(path: string) {
    if (path.endsWith('useFeedDensity')) return { useFeedDensity: () => ['standard'] };
    if (['./ui/helios', './ui/ActionButton', './ui/motion/ShareActionMenu', './notes/SaveNoteButton'].includes(path)) return actualRequire(path);
    if (path.startsWith('.')) return {};
    return actualRequire(path);
  } });
  const props = { item: { ...item('portal'), timeAgo: '1h ago' }, viewMode: 'list', isAiLoading: true, onToggleAi: () => { throw new Error('No AI request during render'); } };
  const render = (options: object) => renderToStaticMarkup(React.createElement(NoteEditorProvider, null, React.createElement(exports.testCard, { ...props, ...options })));
  const busy = render({});
  assert.ok(busy.includes('Generating AI summary'));
  assert.equal((busy.match(/<button\b/g) || []).length, 3);
  assert.equal((busy.match(/disabled=""/g) || []).length, 1);
  assert.ok(busy.includes('Share article'));
  assert.ok(busy.includes('Save note on this article'));
  assert.ok(busy.includes('href="https://publisher.example/story/portal"'));
  assert.ok(!busy.includes('Broadcast headline'));
  assert.ok(!busy.includes('AI Takeaway'));
  assert.ok(!busy.includes('Read original article'));
  const expanded = render({ isAiLoading: false, isAiExpanded: true, aiSummary: 'Verified fixture summary' });
  assert.ok(expanded.includes('Hide AI summary'));
  assert.ok(expanded.includes('aria-expanded="true"'));
  assert.ok(expanded.includes('Verified fixture summary'));
});
