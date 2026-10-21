import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  cleanCanonicalUrl,
  escapeHtmlText,
  escapeHtmlAttr,
  buildPrehydratedHtml,
  prerenderFilingHtml,
  prerenderCompanyHtml,
  buildSitemapIndexXml,
  buildAnnouncementsFeedCards,
  PRELOADER_CARD_RE
} from '../services/seoPrerender.js';

describe('Server-Side SEO Pre-Hydration & Validation Architecture', () => {

  // Test 1: Canonical URL sanitizer automatically strips utility & tracking query parameters
  test('cleanCanonicalUrl strips utility queries and preserves pure canonical URL', () => {
    const dirtyUrl1 = 'https://bsenexus.in/filing/RELIANCE/12345?tab=announcements&utm_source=google&utm_medium=cpc';
    assert.strictEqual(cleanCanonicalUrl(dirtyUrl1), 'https://bsenexus.in/filing/RELIANCE/12345');

    const dirtyUrl2 = 'https://bsenexus.in/company/TCS?design=preview&action=upgrade';
    assert.strictEqual(cleanCanonicalUrl(dirtyUrl2), 'https://bsenexus.in/company/TCS');

    const cleanUrl = 'https://bsenexus.in/guides/sebi-lodr-regulation-30';
    assert.strictEqual(cleanCanonicalUrl(cleanUrl), 'https://bsenexus.in/guides/sebi-lodr-regulation-30');
  });

  // Test 2: Pre-hydrated filing HTML renders semantic tags, JSON-LD NewsArticle, and #root content
  test('prerenderFilingHtml injects route-specific title, canonical, JSON-LD, and #root block', () => {
    const mockAnnouncement = {
      id: 'ann_500325_20261014_01',
      newsId: 'ann_500325_20261014_01',
      companyName: 'Reliance Industries Limited',
      symbol: 'RELIANCE',
      scripCode: '500325',
      subject: 'Outcome of Board Meeting - Financial Results',
      details: 'The Board of Directors approved the unaudited financial results.',
      category: 'COMPANY_UPDATE',
      aiSummary: 'Net profit increased by 12% YoY driven by retail and digital services segments.',
      bseTime: '14 Oct 2026 18:30 IST'
    };

    const mockTemplate = `<!DOCTYPE html><html><head><title>Bsenexus</title></head><body><div id="root"></div></body></html>`;
    const html = prerenderFilingHtml(mockAnnouncement, 'RELIANCE', 'ann_500325_20261014_01', mockTemplate);

    // Title & Canonical
    assert.ok(html.includes('<title>Reliance Industries Limited — Outcome of Board Meeting - Financial Results | Bsenexus</title>'));
    assert.ok(html.includes('<link rel="canonical" href="https://bsenexus.in/filing/RELIANCE/ann_500325_20261014_01"'));

    // OpenGraph & Twitter
    assert.ok(html.includes('<meta property="og:title" content="Reliance Industries Limited — Outcome of Board Meeting - Financial Results | Bsenexus"'));
    assert.ok(html.includes('<meta property="og:type" content="article"'));
    assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image"'));

    // Semantic content inside #root
    assert.ok(html.includes('<div id="root">'));
    assert.ok(html.includes('Reliance Industries Limited'));
    assert.ok(html.includes('BSE: 500325'));
    assert.ok(html.includes('Outcome of Board Meeting - Financial Results'));
    assert.ok(html.includes('Net profit increased by 12% YoY'));

    // Structured JSON-LD NewsArticle schema
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(jsonLdMatch, 'JSON-LD script must be present');
    const jsonLd = JSON.parse(jsonLdMatch[1]);
    assert.strictEqual(jsonLd['@type'], 'NewsArticle');
    assert.strictEqual(jsonLd.mainEntityOfPage, 'https://bsenexus.in/filing/RELIANCE/ann_500325_20261014_01');
    assert.strictEqual(jsonLd.author.name, 'Reliance Industries Limited');
    assert.strictEqual(jsonLd.publisher.name, 'Bsenexus');
  });

  // Test 3: Pre-hydrated company HTML renders Corporation + FAQPage schema and #root semantic block
  test('prerenderCompanyHtml injects Corporation and FAQPage schemas and semantic #root content', () => {
    const mockIntel = {
      companyName: 'Tata Consultancy Services Limited',
      recentFilings: [
        {
          id: 'tcs_ann_01',
          headline: 'Intimation of Board Meeting for Q2 Earnings',
          bseTime: '10 Oct 2026'
        }
      ],
      upcomingEvent: {
        meetingDate: '2026-10-20',
        purpose: 'Audited Financial Results'
      }
    };

    const mockTemplate = `<!DOCTYPE html><html><head><title>Bsenexus</title></head><body><div id="root"></div></body></html>`;
    const html = prerenderCompanyHtml(mockIntel, 'TCS', '532540', mockTemplate);

    // Title & Canonical
    assert.ok(html.includes('<title>Tata Consultancy Services (TCS) BSE Announcements &amp; Filings Live | Bsenexus</title>'));
    assert.ok(html.includes('<link rel="canonical" href="https://bsenexus.in/company/TCS"'));

    // Semantic content inside #root
    assert.ok(html.includes('<div id="root">'));
    assert.ok(html.includes('Tata Consultancy Services Limited (TCS)'));
    assert.ok(html.includes('BSE: 532540'));
    assert.ok(html.includes('Intimation of Board Meeting for Q2 Earnings'));

    // Multi-graph JSON-LD
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(jsonLdMatch, 'JSON-LD script must be present');
    const jsonLd = JSON.parse(jsonLdMatch[1]);
    assert.ok(Array.isArray(jsonLd['@graph']), 'Multi-graph must be an array');

    const corp = jsonLd['@graph'].find((n: any) => n['@type'] === 'Corporation');
    assert.ok(corp, 'Corporation node must exist');
    assert.strictEqual(corp.name, 'Tata Consultancy Services Limited');
    assert.strictEqual(corp.tickerSymbol, 'BSE:532540');

    const faq = jsonLd['@graph'].find((n: any) => n['@type'] === 'FAQPage');
    assert.ok(faq, 'FAQPage node must exist');
    assert.ok(faq.mainEntity.length >= 3, 'FAQPage must contain at least 3 Q&A pairs');
  });

  // Test 4: Tiered sitemap index generator links to core, companies, and hot filings sitemaps
  test('buildSitemapIndexXml creates valid sitemap index linking to tiered sitemaps', () => {
    const xml = buildSitemapIndexXml('2026-10-15');
    assert.ok(xml.includes('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
    assert.ok(xml.includes('<loc>https://bsenexus.in/sitemap-core.xml</loc>'));
    assert.ok(xml.includes('<loc>https://bsenexus.in/sitemap-companies.xml</loc>'));
    assert.ok(xml.includes('<loc>https://bsenexus.in/sitemap-filings-hot.xml</loc>'));
    assert.ok(xml.includes('<lastmod>2026-10-15</lastmod>'));
  });

  // Test 5: server.ts routes handle dynamic entity validation with HTTP 404 and robots noindex
  test('server.ts defines 404 responses with robots noindex for invalid entity routes', () => {
    const serverPath = path.join(process.cwd(), 'server.ts');
    const serverSource = fs.readFileSync(serverPath, 'utf8');

    // /filing/:symbol/:newsId validation check
    assert.ok(serverSource.includes("app.get('/filing/:symbol/:newsId'"), '/filing/:symbol/:newsId route must exist');
    assert.ok(serverSource.includes("renderAnnouncement404Page("), 'Filing not found must call renderAnnouncement404Page');

    // /company/:symbol validation check
    assert.ok(serverSource.includes("renderCompany404Page(symbol)"), 'Company not found must call renderCompany404Page');

    // /results/:symbol/:quarterKey validation check
    assert.ok(serverSource.includes("renderResults404Page(symbol, quarterKey)"), 'Results not found must call renderResults404Page');

    // /guides/:slug validation check
    assert.ok(serverSource.includes("renderGuide404Page("), 'Guide not found must call renderGuide404Page');
  });

  // Test 6: API and Auth routes set X-Robots-Tag: noindex, nofollow
  test('server.ts enforces X-Robots-Tag: noindex, nofollow on /api and /auth routes', () => {
    const serverPath = path.join(process.cwd(), 'server.ts');
    const serverSource = fs.readFileSync(serverPath, 'utf8');

    assert.ok(serverSource.includes("app.use(['/api', '/auth']"), '/api and /auth middleware must exist');
    assert.ok(serverSource.includes("res.setHeader('X-Robots-Tag', 'noindex, nofollow')"), 'X-Robots-Tag header must be set');
  });

  // Test 7: PRELOADER_CARD_RE matches only styled preloader cards, never plain FAQ articles
  test('PRELOADER_CARD_RE targets preloader placeholders without touching AEO FAQ', () => {
    const preloaderCard = '<article style="background: #181624; border: 1px solid #2D283E;"><span>X</span></article>';
    const faqArticle = '<article><h3>What is Bsenexus?</h3><p>...</p></article>';
    assert.ok(PRELOADER_CARD_RE.test(preloaderCard), 'must match styled preloader card');
    PRELOADER_CARD_RE.lastIndex = 0;
    assert.ok(!PRELOADER_CARD_RE.test(faqArticle), 'must NOT match plain FAQ article');
    PRELOADER_CARD_RE.lastIndex = 0;
  });

  // Test 8: buildAnnouncementsFeedCards never throws; returns '' gracefully when feed is empty
  test('buildAnnouncementsFeedCards resolves to a string without throwing', async () => {
    const result = await buildAnnouncementsFeedCards();
    assert.strictEqual(typeof result, 'string', 'must always resolve to a string');
    if (result) {
      assert.ok(!result.includes('<script'), 'cards must not contain scripts');
      assert.ok(result.includes('/filing/') || result.includes('/announcement/'), 'cards must link to filing pages');
    }
  });

  // Test 9: /announcements serves pre-rendered feed (Soft-404 fix)
  test('server.ts pre-renders /announcements feed with real filing cards', () => {
    const serverPath = path.join(process.cwd(), 'server.ts');
    const serverSource = fs.readFileSync(serverPath, 'utf8');

    assert.ok(serverSource.includes("app.get(['/announcements', '/announcements/']"), '/announcements route must exist before the catch-all');
    assert.ok(serverSource.includes('buildAnnouncementsFeedCards()'), 'route must build real filing cards');
    assert.ok(serverSource.includes("announcements-feed-v2"), 'updated neutral shell feed HTML must be cached with explicit key');
    assert.ok(serverSource.includes("html.replace('<!--announcements-feed-->'"), 'real cards must target the announcements-only insertion point');
    assert.ok(serverSource.includes('ttlMs: 5 * 60 * 1000'), 'feed cache must have a short 5-minute TTL');
  });

  // Test 10: confirmed-dead batch_test_ URLs return 410 Gone instead of 404
  test('server.ts returns 410 Gone for dead batch_test_ announcement URLs', () => {
    const serverPath = path.join(process.cwd(), 'server.ts');
    const serverSource = fs.readFileSync(serverPath, 'utf8');

    const gone410Count = (serverSource.match(/res\.status\(410\)/g) || []).length;
    assert.ok(gone410Count >= 2, `expected 410 handlers in filing + announcement routes, found ${gone410Count}`);
    assert.ok(serverSource.includes("includes('batch_test_')"), '410 must be gated on the batch_test_ pattern');
  });
});
