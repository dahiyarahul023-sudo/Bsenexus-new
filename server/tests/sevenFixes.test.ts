import { publicFilingPresentation } from '../../src/shared/filingPresentation.js';
import { formatFullDateTime, parseFilingTimestamp } from '../../src/utils/timeFormat.js';
import { selectCompanyPeers } from '../utils/companyPeers.js';
import { injectRouteHeading } from '../utils/routeHeading.js';
import { companyFilingStats } from '../../src/shared/companyFilings.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
import { hasExactScripCode, matchesCompanyFiling } from '../../src/shared/scripMatching.js';
import { TOP_COMPANIES } from '../../src/config/topCompanies.js';
import { EXCHANGE_COMPANIES, exchangeCompany } from '../../src/config/exchangeCompanies.js';
import { DIRECTORY_COMPANIES, directoryDescription, directoryBadge } from '../../src/config/companyDirectory';
import { getScripCode } from '../utils/stockResolver.js';
import { isSymbolMatch, scriptSafeJson } from '../utils/helpers.js';

const targets = [['RELIANCE', '500325'], ['CLEAN', '543318'], ['CONCOR', '531344'], ['HAL', '541154'], ['IDEA', '532822'], ['OIL', '533106']];
function load(source: string, globals: any = {}) {
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = vm.createContext({ exports: {}, console, injectRouteHeading, DIRECTORY_COMPANIES, directoryDescription, directoryBadge, exchangeCompany, matchesCompanyFiling, scriptSafeJson, formatFullDateTime, parseFilingTimestamp, publicFilingPresentation, ...globals });
  vm.runInContext(code, context);
  return context;
}
const serverSource = readFileSync('server.ts', 'utf8');
const serverAst = ts.createSourceFile('server.ts', serverSource, ts.ScriptTarget.Latest, true);
function declarations(names: string[]) {
  return serverAst.statements.filter(node => {
    if (ts.isFunctionDeclaration(node)) return names.includes(node.name?.text || '');
    if (ts.isVariableStatement(node)) return node.declarationList.declarations.some(d => ts.isIdentifier(d.name) && names.includes(d.name.text));
    return false;
  }).map(node => node.getText(serverAst)).join('\n');
}

test('public company financial rows keep long filing evidence collapsed, with the period, date and PDF accessible', () => {
  const ctx = load(declarations(['renderCompanyPage', 'escapeHtmlText', 'escapeHtmlAttr']), {
    hasExactScripCode, AI_STUDIO_REDIRECT_SCRIPT: '', getAllStockEntries: () => [],
  });
  const sourceText = 'Original quarterly filing details & board approval. '.repeat(25);
  const output = ctx.renderCompanyPage({ companyName: 'Wipro Limited', quarterlyResults: [{
    scripCode: '507685', periodOrMeeting: 'Quarter Ended 30-Sep-2026 (Q2 FY27)', declarationDate: '15 Oct 2026',
    status: 'Declared', subject: sourceText, pdfLink: 'https://www.bseindia.com/filing.pdf',
  }] }, 'WIPRO', '507685');
  const table = output.match(/<table class="results-table"[^>]*>[\s\S]*?<\/table>/)[0];
  const disclosure = table.match(/<details\b([^>]*)>([\s\S]*?)<\/details>/);
  assert.ok(disclosure, 'long filing evidence has an expandable disclosure');
  assert.doesNotMatch(disclosure[1], /\bopen\b/, 'long evidence starts collapsed');
  const summary = disclosure[2].match(/<summary>([\s\S]*?)<\/summary>/)[1].replace(/<[^>]+>/g, '');
  assert.ok(summary.length < 220, 'visible filing summary is bounded');
  assert.ok(disclosure[2].includes(sourceText.replace(/&/g, '&amp;')), 'full original evidence remains accessible');
  assert.ok(table.includes('Quarter Ended 30-Sep-2026 (Q2 FY27)'));
  assert.ok(table.includes('15 Oct 2026'));
  assert.match(table, /href="https:\/\/www\.bseindia\.com\/filing\.pdf"/);
});

for (const [symbol, scrip] of targets) {
  test(`${symbol}: only its exact BSE scrip identifies a filing`, () => {
    assert.equal(getScripCode(symbol), scrip);
    for (const field of ['scrip_cd', 'SCRIP_CD', 'scripCode']) {
      assert.equal(hasExactScripCode({ [field]: Number(scrip), companyName: 'Unrelated name' }, scrip), true);
      assert.equal(hasExactScripCode({ [field]: '500001', companyName: symbol, symbol, subject: symbol }, scrip), false);
    }
    assert.equal(hasExactScripCode({ companyName: symbol, symbol, subject: symbol }, scrip), false);
    assert.equal(hasExactScripCode({ scrip_cd: scrip, scripCode: '500001' }, scrip), false);
    assert.equal(hasExactScripCode({ scrip_cd: scrip + '0' }, scrip), false);
    assert.equal(hasExactScripCode({ scrip_cd: scrip }, ''), false);
    assert.equal(isSymbolMatch(symbol, symbol, symbol, '500001'), false);
    assert.equal(isSymbolMatch(symbol, symbol, symbol), false);
    assert.equal(isSymbolMatch('', '', symbol, scrip), true);
  });

  test(`${symbol}: actual intelligence excludes wrong/missing codes from filings and history`, async () => {
    const good = { id: 'good', scrip_cd: scrip, subject: 'EXACT DISCLOSURE', bseTime: '2026-10-12T12:00:00Z', timestamp: 100 };
    const wrong = { id: 'wrong', scrip_cd: '500001', symbol, companyName: symbol, subject: 'WRONG DISCLOSURE', timestamp: 999 };
    const missing = { id: 'missing', symbol, companyName: symbol, subject: 'MISSING DISCLOSURE', timestamp: 998 };
    const history = [{ id: 'history', scripCode: scrip, status: 'Declared', quarterKey: 'Q1FY27', subject: 'GOOD HISTORY', meetingDate: '2026-06-30' },
      { id: 'bad-history', scripCode: '500001', symbol, status: 'Declared', quarterKey: 'Q2FY27', subject: 'BAD HISTORY', meetingDate: '2026-09-30' }];
    const ctx = load(readFileSync('server/services/companyIntelService.ts', 'utf8'), {
      setTimeout: () => 0,
      require(path: string) {
        if (path.endsWith('/companyPeers.js')) return { selectCompanyPeers };
        if (path.endsWith('/companyFilings.js')) return { companyFilingStats };
        if (path.endsWith('/scripMatching.js')) return { hasExactScripCode, matchesCompanyFiling };
        if (path === 'yahoo-finance2') return { default: class { async quote() { return { regularMarketPrice: 100, shortName: symbol }; } } };
        if (path.endsWith('/resultsCalendarService.js')) return {
          getStockResultsHistory: async () => history,
          getResultsCalendarSnapshot: async () => ({ items: [{ scripCode: '500001', symbol, status: 'UPCOMING', daysLeft: 2, meetingDate: '2099-01-01' }] }),
          autoFetchDeepHistoricalResults: async () => false,
        };
        if (path.endsWith('/announcementDao.js')) return { getRecentAnnouncements: async () => [wrong, missing, good], getAnnouncementsForScrip: async () => [wrong] };
        if (path.endsWith('/timelineClassifier.js')) return { classifyMaterialEvent: () => null };
        if (path.endsWith('/helpers.js')) return { parseBseDate: () => 0 };
        if (path.endsWith('/stockResolver.js')) return { getAllStockEntries: () => [] };
        return {};
      },
    });
    const result = await ctx.exports.getCompanyIntelligence(scrip, symbol);
    assert.deepEqual(Array.from(result.recentFilings, (f: any) => f.id).sort(), ['good']);
    assert.deepEqual(Array.from(result.quarterlyResults, (f: any) => f.id), ['history']);
    assert.equal(result.upcomingEvent, undefined);
  });

  test(`${symbol}: rendered page, metadata and FAQ never use a mismatched latest disclosure`, () => {
    const ctx = load(declarations(['renderCompanyPage', 'escapeHtmlText', 'escapeHtmlAttr']), {
      hasExactScripCode, AI_STUDIO_REDIRECT_SCRIPT: '', getAllStockEntries: () => [],
    });
    const output = ctx.renderCompanyPage({ companyName: symbol,
      recentFilings: [{ scripCode: '500001', subject: 'WRONG DISCLOSURE', timestamp: 999 }, { scripCode: scrip, subject: 'EXACT DISCLOSURE', timestamp: 100 }],
      quarterlyResults: [{ scripCode: '500001', subject: 'WRONG RESULTS' }],
    }, symbol, scrip);
    assert.ok(output.includes('EXACT DISCLOSURE'));
    assert.ok(!output.includes('WRONG DISCLOSURE'));
    assert.ok(!output.includes('WRONG RESULTS'));
    const graph = JSON.parse(output.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    const faq = graph['@graph'].find((node: any) => node['@type'] === 'FAQPage');
    assert.ok(faq.mainEntity[0].acceptedAnswer.text.includes('EXACT DISCLOSURE'));
  });
}

test('sitemap parses with a strict XML parser; alias URLs are excluded', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const urls = JSON.parse(execFileSync(pythonBin, ['-c', 'import xml.etree.ElementTree as E,json; r=E.parse("public/sitemap.xml"); print(json.dumps([e.text for e in r.iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]))'], { encoding: 'utf8' }));
  assert.ok(urls.includes('https://bsenexus.in/company/M&M'));
  assert.ok(!urls.includes('https://bsenexus.in/live'));
  assert.ok(!urls.includes('https://bsenexus.in/privacy'));
});

test('homepage no-script HTML links every curated company with its correct listing identity', () => {
  assert.equal(TOP_COMPANIES.length, 29);
  assert.equal(new Set(TOP_COMPANIES.map(c => c.symbol)).size, 29);
  const index = readFileSync('index.html', 'utf8');
  const section = index.match(/<section aria-labelledby="noscript-top-companies-heading">([\s\S]*?)<\/section>/)?.[1] || '';
  assert.equal(TOP_COMPANIES, DIRECTORY_COMPANIES);
  for (const c of TOP_COMPANIES) {
    assert.ok(section.includes(`href="/company/${c.symbol}"`), c.symbol);
    assert.ok(section.includes(c.listingLabel || `BSE: ${c.scripCode}`), c.symbol);
    assert.ok(section.includes(c.name.replaceAll('&', '&amp;')), c.symbol);
  }
});

test('server directory renders exchange names, correct listings and all current discovery links', () => {
  const ctx = load(declarations(['renderCompaniesDirectoryPage', 'escapeHtmlText', 'escapeHtmlAttr']), { EXCHANGE_COMPANIES, AI_STUDIO_REDIRECT_SCRIPT: '' });
  const html = ctx.renderCompaniesDirectoryPage();
  for (const company of EXCHANGE_COMPANIES) {
    assert.ok(html.includes(`href="https://bsenexus.in/company/${company.symbol}"`));
    assert.ok(html.includes(company.name));
    assert.ok(html.includes(company.listingLabel));
  }
  assert.doesNotMatch(html, /BSE: 540025|26 PREMIER/);
  assert.match(html, /"numberOfItems":\s*29/);
  assert.ok(html.includes('29 CURATED PROFILES'));
  assert.ok(html.includes('Explore 29 curated company, REIT and exchange operator profiles'));
});

test('live alias metadata uses the announcements canonical', () => {
  const ctx = load(declarations(['TAB_SEO_CONFIG', 'TAB_ALIASES', 'injectTabSeoMetadata', 'escapeHtmlText', 'escapeHtmlAttr']));
  const output = ctx.injectTabSeoMetadata(readFileSync('index.html', 'utf8'), 'announcements');
  assert.ok(output.includes('<link rel="canonical" href="https://bsenexus.in/announcements"'));
});

test('privacy alias handler returns a permanent redirect, not duplicate content', () => {
  let handler: any;
  const route = serverAst.statements.find(node => ts.isExpressionStatement(node) && node.getText(serverAst).startsWith("app.get(['/privacy', '/privacy/']"));
  assert.ok(route);
  load(route.getText(serverAst), { app: { get(_paths: string[], fn: any) { handler = fn; } } });
  let response: any;
  handler({}, { redirect(status: number, location: string) { response = { status, location }; } });
  assert.deepEqual(response, { status: 301, location: '/privacy-policy' });
  const redirects = readFileSync('public/_redirects', 'utf8');
  assert.ok(redirects.indexOf('/privacy /privacy-policy 301') < redirects.indexOf('/* /index.html 200'));
});

test('BSE and NSE render stored official disclosures through the regular company page without mixed identities', async () => {
  const bseFiling = {id:'bse-official',symbol:'BSE',companyName:'BSE Limited',scrip_cd:'',subject:'EXCHANGE OPERATOR DISCLOSURE',pdfLink:'https://nsearchives.nseindia.com/corporate/BSE1_21102026130745_NSEintimation.pdf',bseTime:'2026-10-21T13:07:45Z'};
  const wrong = {id:'enzyme',scrip_cd:'540025',companyName:'Advanced Enzyme Technologies Ltd',subject:'UNRELATED ENZYME DISCLOSURE',pdfLink:'https://www.bseindia.com/xml-data/corpfiling/AttachLive/enzyme.pdf'};
  const ctx = load(readFileSync('server/services/companyIntelService.ts','utf8'), {
    setTimeout:()=>0,
    require(path:string) {
      if(path.endsWith('/companyPeers.js')) return {selectCompanyPeers};
      if(path.endsWith('/companyFilings.js')) return {companyFilingStats};
      if(path.endsWith('/helpers.js')) return {parseBseDate:(value:string)=>Date.parse(value)||0};
      if(path.endsWith('/scripMatching.js'))return {hasExactScripCode,matchesCompanyFiling};
      if(path==='yahoo-finance2')return {default:class {async quote(){return null;}}};
      if(path.endsWith('/resultsCalendarService.js'))return {getStockResultsHistory:async()=>{throw new Error('BSE-only history must not run for NSE-only equity');},getResultsCalendarData:async()=>{throw new Error('BSE calendar must not be read for NSE-only equity');}};
      if(path.endsWith('/announcementDao.js'))return {getBseOperatorAnnouncements:async()=>[bseFiling,wrong],getRecentAnnouncements:async()=>{throw new Error('Use exact durable operator read');}};
      if(path.endsWith('/timelineClassifier.js'))return {classifyMaterialEvent:()=>null};
      if(path.endsWith('/stockResolver.js'))return {getAllStockEntries:()=>[]};
      return {};
    },
  });
  const intel=await ctx.exports.getCompanyIntelligence('540025','BSE'); // ignore poisoned old caller code
  assert.equal(intel.scripCode,'');
  assert.deepEqual(Array.from(intel.recentFilings,(f:any)=>f.id),['bse-official']);
  assert.equal(intel.upcomingEvent,undefined);
  const renderer=load(declarations(['renderCompanyPage','escapeHtmlText','escapeHtmlAttr']),{AI_STUDIO_REDIRECT_SCRIPT:'',getAllStockEntries:()=>[]});
  const bseHtml=renderer.renderCompanyPage({...intel,companyName:'BSE Limited'},'BSE','');
  assert.match(bseHtml,/EXCHANGE OPERATOR DISCLOSURE/);
  assert.doesNotMatch(bseHtml,/UNRELATED ENZYME DISCLOSURE|BSE:540025/);
  assert.match(bseHtml,/Announcements &amp; Filings \| BSE Nexus|Announcements & Filings \| BSE Nexus/);
  assert.match(bseHtml,/NSE:BSE/);
  assert.match(bseHtml,/Meeting dates for BSE Limited are available from NSE/);
  const nseHtml=renderer.renderCompanyPage({companyName:'National Stock Exchange of India Limited',recentFilings:[{id:'nse',scripCode:'544937',subject:'NSE STORED FILING'},wrong]},'NSE','544937');
  assert.match(nseHtml,/NSE STORED FILING/);assert.doesNotMatch(nseHtml,/UNRELATED ENZYME DISCLOSURE/);
  assert.match(nseHtml,/BSE:544937/);
});

test('actual public operator route uses ordinary intelligence/cache and accepts NSE-only BSE without a scrip', async () => {
  const route = serverAst.statements.find(node => node.getText(serverAst).startsWith("app.get(['/company/:symbol', '/stock/:symbol']"))!.getText(serverAst);
  let handler:any;
  const calls:any[]=[];
  load(route, {
    app:{get:(_paths:any,fn:any)=>{handler=fn;}}, getScripCode, getAllStockEntries:()=>[],
    renderCompany404Page:()=> 'NOT FOUND', pageRenderCache:{get:()=>null,set:(_key:string,body:string)=>({body,etag:'fixture'})},
    getCompanyIntelligence:async(code:string,symbol:string)=>{calls.push([code,symbol]);return {companyName:symbol};},
    renderCompanyPage:(_data:any,symbol:string,code:string)=>`regular profile ${symbol}:${code}`,
  });
  for(const [symbol,code] of [['BSE',''],['NSE','544937']]){
    const output:any={statusCode:200};const res:any={status:(status:number)=>{output.statusCode=status;return res;},setHeader:()=>res,send:(body:string)=>{output.body=body;return res;}};
    await handler({params:{symbol},path:'/company/'+symbol,headers:{}},res);
    assert.equal(output.statusCode,200);assert.equal(output.body,`regular profile ${symbol}:${code}`);
  }
  assert.deepEqual(calls,[['','BSE'],['544937','NSE']]);
});

test('public filing and company quote distinguish source publication time from fetch time', async () => {
  const ctx = load(declarations(['renderAnnouncementPage', 'renderCompanyPage', 'escapeHtmlText', 'escapeHtmlAttr']), {
    AI_STUDIO_REDIRECT_SCRIPT: '', getRecentAnnouncements: async () => [], getAllStockEntries: () => [],
  });
  const filing = { companyName: 'Example Ltd', subject: 'Investor conference call', category: 'CONFERENCE_CALL', scripCode: '500325' };
  const visible = await ctx.renderAnnouncementPage({ ...filing, bseTime: '2026-11-01T23:05:17' }, 'fixture');
  assert.match(visible, /class="badge">Conference call<\/span>/);
  assert.match(visible, /datetime="2026-11-01T17:35:17.000Z">01 Nov 2026, 11:05:17 PM IST<\/time>/);
  assert.match(visible, /href="\/announcements" class="app-btn">\s*Open Filings terminal/);
  const unknown = await ctx.renderAnnouncementPage({ ...filing, fetched_at: Date.now() }, 'fixture');
  assert.match(unknown, /Publication time unavailable/);
  assert.doesNotMatch(unknown, /"datePublished"/);
  const priceAsOf = Date.parse('2026-11-01T10:00:17Z');
  const company = ctx.renderCompanyPage({ companyName: 'Example Ltd', quote: { price: 152, priceAsOf, exchange: 'BSE' } }, 'RELIANCE', '500325');
  assert.match(company, /Quote as of 01 Nov 2026, 03:30:17 PM IST · BSE/);
  assert.match(ctx.renderCompanyPage({ companyName: 'Example Ltd', quote: { price: 152 } }, 'RELIANCE', '500325'), /Quote time unavailable/);
});
