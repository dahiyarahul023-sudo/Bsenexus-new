import type { StoryArtworkKind, StoryChapter, StoryCompany, StorySlide, StorySource, StoryTopic } from './storyTypes';

export const MAX_MAJOR_STORY_AGE_MS = 18 * 60 * 60 * 1000;
const record = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {};
const array = (v: unknown): any[] => Array.isArray(v) ? v : [];
const text = (v: unknown) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const storyNumber = (value: number, decimals = 0) => value.toLocaleString('en-IN', { maximumFractionDigits: decimals });
export const storyCash = (value: number) => `${value < 0 ? '−' : value > 0 ? '+' : ''}₹${storyNumber(Math.abs(value))} Cr`;
export const storyPercent = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}%`;

export function safeStoryUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try { const url = new URL(value); if (url.protocol === 'https:' && !url.username && !url.password) return url.href; } catch {}
}

function companyOf(value: unknown): StoryCompany | undefined {
  const item = record(value);
  const name = text(item.companyName || item.name);
  const scripCode = String(item.scripCode || '').trim();
  const symbol = text(item.symbol);
  // A guessed short name, placeholder or news publisher must never become a company action.
  if (!/^\d{6}$/.test(scripCode) || !name || /^(stock|bse stock|bse|nse|media|unknown|pending|\d+)$/i.test(name)) return;
  return { scripCode, symbol, name };
}

function timestamp(value: unknown): number {
  if (finite(value)) return value;
  if (typeof value !== 'string' || !/(?:Z|[+-]\d{2}:?\d{2}|GMT)$/i.test(value)) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fresh(value: number, now: number) { return value > 0 && value <= now && now - value <= MAX_MAJOR_STORY_AGE_MS; }
function groups<T>(items: T[], size = 3): T[][] { return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size)); }

/** Break copy at sentence/clause boundaries. Nothing is silently ellipsized or shrunk. */
export function storyTextPages(value: string, budget = 38): string[] {
  const copy = text(value);
  if (!copy) return [];
  const clauses = copy.split(/(?<=[.!?;])\s+/);
  const pages: string[] = [];
  let page = '';
  for (const clause of clauses) {
    const words = clause.trim().split(/\s+/);
    while (words.length) {
      const used = page ? page.split(/\s+/).length : 0;
      if (used && used + words.length > budget) { pages.push(page); page = ''; continue; }
      const next = words.splice(0, budget - used).join(' ');
      page = [page, next].filter(Boolean).join(' ');
      if (words.length) { pages.push(page); page = ''; }
    }
  }
  if (page) pages.push(page);
  return pages;
}

export function storyArtworkFor(value: string): StoryArtworkKind {
  if (/\b(bank|banking|deposit|credit|lending|finance|insurance)\b/i.test(value)) return 'banking';
  if (/\b(power|energy|solar|electric|gas|renewable|oil)\b/i.test(value)) return 'energy';
  if (/\b(pharma|health|hospital|drug|medicine)\b/i.test(value)) return 'healthcare';
  if (/\b(mining|steel|plant|factory|manufactur|cement|order|contract|epc)\w*/i.test(value)) return 'industry';
  return 'markets';
}

export function getStoryDuration(slide: StorySlide): number {
  const visualCopy = slide.layout === 'list' ? slide.items.flatMap(item => [item.label, item.detail, item.value])
    : slide.layout === 'comparison' ? slide.blocks.flatMap(block => [block.label, block.value, block.detail])
    : slide.layout === 'metric' ? [slide.metric.label, slide.metric.value, slide.metric.detail]
    : slide.layout === 'chart' ? [slide.chart.title, ...slide.chart.series.map(series => series.label), ...slide.chart.points.map(point => point.label)] : [];
  const words = [slide.title, slide.summary, ...visualCopy].filter(Boolean).join(' ').split(/\s+/).length;
  const visualTime = slide.layout === 'chart' || slide.layout === 'list' || slide.layout === 'comparison' ? 3500 : 1500;
  return Math.max(7000, Math.min(18000, 3000 + words * 230 + visualTime));
}

/** A pending topic wins once; later refreshes preserve the reader's stable slide ID. */
export function resolveStorySelection(chapters: StoryChapter[], previousId = '', requestedTopic?: string) {
  const target = requestedTopic ? chapters.find(chapter => chapter.id === requestedTopic) : undefined;
  const retained = chapters.some(chapter => chapter.slides.some(slide => slide.id === previousId));
  return {
    activeId: target?.slides[0]?.id || (retained ? previousId : chapters[0]?.slides[0]?.id || ''),
    missingTopic: Boolean(requestedTopic && !target),
  };
}

/** Adapter for the existing read-only /api/story/feed. Missing data omits a section. */
export function buildStoryChapters(payload: unknown, now = Date.now(), showMarketMoves = true): StoryChapter[] {
  const feed = record(payload);
  if (!finite(feed.timestamp) || feed.timestamp > now + 60_000 || now - feed.timestamp > MAX_MAJOR_STORY_AGE_MS) throw new Error('Story feed has no current check time');
  const checkedAt = feed.timestamp;
  const chapters: StoryChapter[] = [];
  const add = (id: StoryTopic, title: string, slides: StorySlide[]) => { if (slides.length) chapters.push({ id, title, shortLabel: title, slides }); };
  const base = (id: string, chapterId: StoryTopic, title: string, source: StorySource) => ({ id, chapterId, title, source, checkedAt, subject: { kind: 'topic' as const, topic: chapterId } });

  const market: StorySlide[] = [];
  const indices = record(feed.indices);
  const validIndices = [['SENSEX', record(indices.sensex)], ['NIFTY 50', record(indices.nifty)]].filter(([, item]: any) => finite(item.price) && item.price > 0 && finite(item.changePercent)) as [string, Record<string, any>][];
  if (validIndices.length) market.push({
    ...base('market-indices', 'market-pulse', 'The market at a glance', { name: 'BSE / NSE', dateLabel: 'Latest available snapshot' }),
    layout: 'comparison', emphasis: 'at a glance',
    blocks: validIndices.map(([label, item]) => ({ label, value: storyNumber(item.price, 2), detail: storyPercent(item.changePercent), tone: item.changePercent < 0 ? 'negative' : item.changePercent > 0 ? 'positive' : 'neutral' })),
  });
  if (showMarketMoves) {
    const movers = record(feed.movers);
    for (const [key, title] of [['topGainers', 'Leading the gains'], ['topLosers', 'On the losing side'], ['heavyweights', 'The heavyweight moves']] as const) {
      const seen = new Set<string>();
      const items = array(movers[key]).flatMap(value => {
        const item = record(value); const company = companyOf(item);
        const label = company?.name || text(item.name || item.companyName || item.symbol);
        const identity = company?.scripCode || label.toLowerCase();
        if (!label || seen.has(identity) || !finite(item.changePercent) || !finite(item.price) || item.price <= 0) return [];
        seen.add(identity);
        return [{ id: identity, label, detail: `₹${storyNumber(item.price, 2)}`, value: storyPercent(item.changePercent), tone: item.changePercent < 0 ? 'negative' as const : item.changePercent > 0 ? 'positive' as const : 'neutral' as const, company }];
      });
      groups(items).forEach((page, i) => market.push({ ...base(`market-${key}-${i}`, 'market-pulse', title, { name: 'BSE / NSE', dateLabel: 'Latest available session' }), layout: 'list', items: page }));
    }
  }
  add('market-pulse', 'Market pulse', market);

  const flows: StorySlide[] = [];
  const f = record(feed.fiiDii);
  if (finite(f.fiiNet) && finite(f.diiNet) && text(f.dateStr)) {
    const source = { name: 'NSE · provisional cash market', url: 'https://www.nseindia.com/reports/fii-dii', dateLabel: text(f.dateStr) };
    const net = f.fiiNet + f.diiNet;
    flows.push({
      ...base('flows-net', 'institutional-flows', 'Who bought, who sold?', source),
      emphasis: 'bought', layout: 'chart', summary: `Combined net ${net < 0 ? 'selling' : net > 0 ? 'buying' : 'flow'}: ${storyCash(net)}.`,
      chart: { title: 'FII and DII net cash flows', unit: '₹ Cr', signed: true, series: [{ label: 'Net flow' }], points: [{ label: 'FII', values: [f.fiiNet] }, { label: 'DII', values: [f.diiNet] }] },
    });
    if ([f.fiiBuy, f.fiiSell, f.diiBuy, f.diiSell].every(v => finite(v) && v >= 0)) flows.push({
      ...base('flows-gross', 'institutional-flows', 'Inside the trading activity', source),
      layout: 'chart', emphasis: 'trading activity',
      chart: { title: 'Gross purchases and sales by institution', unit: '₹ Cr', series: [{ label: 'Bought', colour: 'blue' }, { label: 'Sold', colour: 'rose' }], points: [{ label: 'FII', values: [f.fiiBuy, f.fiiSell] }, { label: 'DII', values: [f.diiBuy, f.diiSell] }] },
    });
  }
  add('institutional-flows', 'FII / DII flows', flows);

  const calendar: StorySlide[] = [];
  const meetings = record(feed.resultsCalendar); const meetingIds = new Set<string>();
  const rows = [...array(meetings.todayMeetings), ...array(meetings.upcomingMeetings)].flatMap(value => {
    const item = record(value); const company = companyOf(item); const label = company?.name || text(item.companyName || item.symbol);
    const date = text(item.meetingDate); const purpose = text(item.purpose); const id = `${company?.scripCode || label}-${date}-${purpose}`;
    if (!label || !date || meetingIds.has(id) || (finite(item.daysLeft) && item.daysLeft < 0)) return [];
    meetingIds.add(id);
    return [{ id, label, detail: purpose || 'Board meeting', value: date, company }];
  });
  groups(rows).forEach((items, i) => calendar.push({ ...base(`calendar-${items[0].id}`, 'earnings-radar', i ? 'Next on the calendar' : 'Dates to keep in view', { name: 'BSE / NSE board meeting calendar' }), layout: 'list', items }));
  add('earnings-radar', 'Results calendar', calendar);

  const news: StorySlide[] = []; const newsIds = new Set<string>();
  const appendNews = (item: Record<string, any>, kind: 'filing' | 'news') => {
    const publishedAt = timestamp(kind === 'filing' ? item.timestamp : item.publishedAt);
    const headline = text(kind === 'filing' ? item.headline : item.title);
    const link = safeStoryUrl(kind === 'filing' ? item.attachmentUrl : item.link);
    const company = companyOf(item);
    const identity = `${company?.scripCode || ''}:${headline.toLowerCase()}`;
    if (!headline || !fresh(publishedAt, now) || newsIds.has(identity) || (kind === 'news' && !link)) return;
    newsIds.add(identity);
    const shortHeadline = headline.split(/\s+/).length <= 13 && headline.length <= 95;
    const label = text(item.badge || item.category).replace(/_/g, ' ').toLowerCase();
    const title = shortHeadline ? headline : company ? `${company.name}: ${label && label.length <= 25 ? label : 'company update'}` : 'A fresh market update';
    const rawSnippet = text(item.snippet);
    const snippet = rawSnippet.toLowerCase().startsWith(headline.toLowerCase()) ? rawSnippet.slice(headline.length).replace(/^[\s:;.!?—–-]+/, '') : rawSnippet;
    const uniqueSnippet = snippet && snippet.toLowerCase() !== headline.toLowerCase() && !headline.toLowerCase().includes(snippet.toLowerCase()) ? snippet : '';
    const copy = [shortHeadline ? '' : headline, uniqueSnippet].filter(Boolean).join(' ');
    const pages = storyTextPages(copy);
    if (!pages.length) pages.push('');
    // At most three useful story screens; the original source retains all further detail.
    const key = `${kind}-${text(String(item.id || '')) || identity}`;
    (link ? pages.slice(0, 3) : pages).forEach((summary, page) => news.push({
      ...base(`${key}-${page}`, 'corporate-actions', page ? `${company?.name || 'Market update'}: more context` : title, {
        name: kind === 'filing' ? 'BSE filing' : text(item.source) || 'Original report', url: link, publishedAt,
      }),
      subject: company ? { kind: 'company', company } : { kind: 'topic', topic: 'corporate-actions' },
      sequenceId: key,
      layout: 'news', summary: summary || undefined, artwork: storyArtworkFor(`${company?.name || ''} ${headline}`),
    }));
  };
  array(feed.fresh18hAnnouncements).forEach(v => appendNews(record(v), 'filing'));
  array(feed.fresh18hNewsStories).forEach(v => appendNews(record(v), 'news'));
  news.sort((a, b) => (b.source.publishedAt || 0) - (a.source.publishedAt || 0));
  add('corporate-actions', 'Company news', news);
  return chapters;
}
