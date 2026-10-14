import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
import { hasExactScripCode } from '../../src/shared/scripMatching.js';
import { TOP_COMPANIES } from '../../src/config/topCompanies.js';
import { getScripCode } from '../utils/stockResolver.js';
import { isSymbolMatch } from '../utils/helpers.js';

const targets = [['RELIANCE', '500325'], ['CLEAN', '543318'], ['CONCOR', '531344'], ['HAL', '541154'], ['IDEA', '532822'], ['OIL', '533106']];
function load(source: string, globals: any = {}) {
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = vm.createContext({ exports: {}, console, ...globals });
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
        if (path.endsWith('/scripMatching.js')) return { hasExactScripCode };
        if (path === 'yahoo-finance2') return { default: class { async quote() { return { regularMarketPrice: 100, shortName: symbol }; } } };
        if (path.endsWith('/resultsCalendarService.js')) return {
          getStockResultsHistory: async () => history,
          getResultsCalendarData: async () => ({ items: [{ scripCode: '500001', symbol, status: 'UPCOMING', daysLeft: 2, meetingDate: '2099-01-01' }] }),
          autoFetchDeepHistoricalResults: async () => false,
        };
        if (path.endsWith('/announcementDao.js')) return { getRecentAnnouncements: async () => [wrong, missing, good], getAnnouncementsForScrip: async () => [wrong] };
        if (path.endsWith('/timelineClassifier.js')) return { classifyMaterialEvent: () => null };
        if (path.endsWith('/helpers.js')) return { parseBseDate: () => 0 };
        return {};
      },
    });
    const result = await ctx.exports.getCompanyIntelligence(scrip, symbol);
    assert.deepEqual(Array.from(result.recentFilings, (f: any) => f.id).sort(), ['good', 'history']);
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

test('homepage initial HTML links every curated company with name and BSE code', () => {
  assert.equal(TOP_COMPANIES.length, 26);
  assert.equal(new Set(TOP_COMPANIES.map(c => c.scripCode)).size, 26);
  const index = readFileSync('index.html', 'utf8');
  const section = index.match(/<section aria-labelledby="top-companies-heading">([\s\S]*?)<\/section>/)?.[1] || '';
  const directory = readFileSync('src/components/CompaniesPage.tsx', 'utf8');
  for (const c of TOP_COMPANIES) {
    assert.ok(section.includes(`href="/company/${c.symbol}"`), c.symbol);
    assert.ok(section.includes(`BSE: ${c.scripCode}`), c.symbol);
    assert.ok(section.includes(c.name.replaceAll('&', '&amp;')), c.symbol);
    assert.ok(directory.includes(`scripCode: "${c.scripCode}"`));
  }
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
