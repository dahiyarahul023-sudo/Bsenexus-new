import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calendarCacheKey, calendarPreferenceKey, type CalendarScope } from '../../src/shared/calendarScope.js';

const moduleRequire = createRequire(import.meta.url);
const originalCss = moduleRequire.extensions['.css'];
moduleRequire.extensions['.css'] = () => {};
after(() => { if (originalCss) moduleRequire.extensions['.css'] = originalCss; else delete moduleRequire.extensions['.css']; });

function renderScope(scope?: CalendarScope, owner = 'rahul', now = '2026-10-21T10:00:00+05:30', archive = false, details = false, stateOverrides: Record<string, any> = {}, admin = false, query = '') {
  const file = 'src/components/ResultsCalendar.tsx';
  const actual = createRequire(new URL('../../' + file, import.meta.url));
  const exports: any = {};
  class Clock extends Date { static now() { return Date.parse(now); } }
  const storage = { getItem: (key: string) => key === calendarPreferenceKey('rahul') ? scope || null : null, setItem() {} };
  const selected = owner === 'rahul' ? scope || 'all' : 'all';
  const raw = [
    { scripCode: '500325', symbol: 'RELIANCE', companyName: 'Reliance Industries Ltd' },
    ...(selected !== 'watchlist' ? [{ scripCode: '544307', symbol: '544307', companyName: 'Vishal Mega Mart Limited' }] : []),
  ].map(item => ({ ...item, id: item.scripCode, purpose: 'Financial Results', meetingDate: '22/10/2026', meetingTimestamp: Date.parse('2026-10-22T00:00:00+05:30'), status: 'UPCOMING', daysLeft: 1, updatedAt: '' }));
  const sourceText = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file,sourceText,ts.ScriptTarget.Latest,true);
  const view = ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='ResultsCalendarView')!;
  const stateNames:string[]=[];
  function visit(node:ts.Node) {
    if (ts.isVariableDeclaration(node)&&ts.isArrayBindingPattern(node.name)&&node.initializer&&ts.isCallExpression(node.initializer)&&node.initializer.expression.getText(ast)==='useState') stateNames.push(node.name.elements[0].getText(ast));
    ts.forEachChild(node,visit);
  }
  visit(view);let stateIndex=0;
  const code = ts.transpileModule(sourceText, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, {
    exports, Date: Clock, localStorage: storage, URLSearchParams, window: { localStorage: storage, innerWidth: 390, location: { search:query } }, console, setTimeout, clearTimeout,
    require(spec: string) {
      if (spec === 'react' && (archive || details)) return { ...React, useState: (value: any) => {
        const stateName=stateNames[stateIndex++];
        return React.useState(Object.hasOwn(stateOverrides,stateName)?stateOverrides[stateName]:details&&stateName==='selectedModalItem'?raw[0]:archive&&stateName==='statusFilter'?'declared':value);
      } };
      if (spec.endsWith('/AuthContext')) return { useAuth: () => ({ user: { uid: owner }, profile: { tier: 'pro' }, isPro: true, isPaidPro: true, isAdmin:admin, setIsAdminPinModalOpen(){} }) };
      if (spec.endsWith('/IntelModalContext')) return { useIntelModal: () => ({ openIntelModal() {} }) };
      if (spec.endsWith('/aiQuota')) return { useAiQuota: () => ({ canGenerate: true }), syncQuotaFromResponse() {} };
      if (spec.endsWith('/useFeedDensity')) return { useFeedDensity: () => ['comfortable'] };
      if (spec.endsWith('/developerMode')) return { useDeveloperMode: () => ({ isDeveloperMode: false }) };
      if (spec.endsWith('/usePullToRefresh')) return { usePullToRefresh: () => ({ containerRef: null, pullDistance: 0, isPulling: false, isRefreshing: false, progress: 0 }) };
      if (spec.endsWith('/SaveNoteButton')) return { SaveNoteButton: () => null };
      if (spec.endsWith('/MarketHolidaysModal')) return { MarketHolidaysModal: () => null };
      if (spec === '../utils/cache') return { getCacheItem: (key: string) => key === calendarCacheKey(owner, selected) ? raw : null, setCacheItem() {} };
      return actual(spec);
    },
  });
  return renderToStaticMarkup(React.createElement(exports.ResultsCalendar));
}

test('calendar renders the existing date tabs with All, F&O Stocks and Watchlist coverage controls', () => {
  const html = renderScope();
  for (const label of ['All', 'F&amp;O Stocks', 'Watchlist', 'Upcoming', 'Today', 'Results Archive']) assert.ok(html.includes(label), label);
  assert.match(html, /aria-label="Calendar scope"/);
  assert.match(html, /aria-pressed="true"[^>]*>All<\/button>/);
  assert.equal((html.match(/Vishal Mega Mart Limited/g) || []).length, 1);
  assert.equal((html.match(/Reliance Industries Ltd/g) || []).length, 1);
  assert.doesNotMatch(html, /title="Open 360° Stock Intelligence">\s*544307\s*</, 'the primary label must be a company name, not the numeric identity');
  assert.doesNotMatch(html, />544307<\/span>/, 'calendar cards use names; internal security codes remain available to search and detail actions');
  assert.match(html, /calendar-date-heading/);
  assert.doesNotMatch(html, />Market<\/button>/);
});

test('remembered Watchlist/F&O selections render correctly and do not carry into another account', () => {
  const watchlist = renderScope('watchlist');
  assert.match(watchlist, /aria-pressed="true"[^>]*>Watchlist<\/button>/);
  assert.doesNotMatch(watchlist, /Vishal Mega Mart Limited/);
  const fno = renderScope('fno');
  assert.match(fno, /aria-pressed="true"[^>]*>F&amp;O Stocks<\/button>/);
  const differentAccount = renderScope('watchlist', 'another-account');
  assert.match(differentAccount, /aria-pressed="true"[^>]*>All<\/button>/);
});

test('cached October 22 meetings rebase into Archive after IST rollover and remain accessible beyond 30 days without a declaration', () => {
  for (const now of ['2026-10-23T00:00:00+05:30', '2026-12-01T10:00:00+05:30']) {
    const html = renderScope('all', 'rahul', now, true);
    assert.equal((html.match(/Reliance Industries Ltd/g) || []).length, 1);
    assert.equal((html.match(/Vishal Mega Mart Limited/g) || []).length, 1);
    assert.doesNotMatch(html, /results declared in last 30 days/);
  }
});

 test('calendar Details exposes one explicit history sync control, with a truthful year range and no duplicate fetch panel', () => {
  const html=renderScope('all','rahul','2026-10-21T10:00:00+05:30',false,true);
  assert.equal((html.match(/Sync 1Y BSE History/g)||[]).length,1);
  assert.doesNotMatch(html,/Fetch 1 Yr History|Historical Results &amp; Filings Sync|4 Qtrs/);
  assert.match(html,/Last 1 Year/);
  assert.match(html,/Sync imports all BSE filings for the selected period/);
});

test('partial archive notice appears once beside four preserved cards, with admin-only shared priority control', () => {
  const history=[1,2,3,4].map(n=>({id:'r'+n,scripCode:'500325',symbol:'RELIANCE',isOutcome:true,status:'Declared',quarterKey:'FY26-Q'+n,periodOrMeeting:'Quarter '+n,subject:'Financial Results'}));
  const states={stockHistory:history,deepHistoryMsg:'Archive saved: 156 filings. 4 verified results. 3 additional board outcomes await verification.',historyError:null};
  const html=renderScope('all','rahul','2026-10-21T10:00:00+05:30',false,true,states);
  assert.equal(html.split('Archive saved:').length-1,1);assert.match(html,/DECLARED \(4\)/);assert.doesNotMatch(html,/Retry history|Set 10D to HIGH/);
  const admin=renderScope('all','rahul','2026-10-21T10:00:00+05:30',false,true,states,true);
  assert.match(admin,/Set 10D to HIGH/);
});


test('English-only AI summaries participate in AI filter, counts and cards', () => {
  const states={statusFilter:'ai',storedItems:[{id:'english-result',symbol:'RELIANCE',scripCode:'500325',companyName:'Reliance Industries Ltd',purpose:'Financial Results',meetingDate:'21 Oct 2026',meetingTimestamp:Date.parse('2026-10-21T00:00:00+05:30'),daysLeft:0,status:'TODAY',isDeclared:true,aiSummaryEn:'English-only confirmed summary'}]};
  const html=renderScope('all','rahul','2026-10-21T10:00:00+05:30',true,false,states);
  assert.match(html,/English-only confirmed summary/);assert.match(html,/Reliance Industries Ltd/);
});

test('background data shrink renders the last available page immediately rather than a blank page', () => {
  const html=renderScope('all','rahul','2026-10-21T10:00:00+05:30',true,false,{statusFilter:'all',currentPage:8});
  assert.match(html,/Reliance Industries Ltd/);assert.doesNotMatch(html,/Page 8 of 1/);
});

test('runup failure shows retry without a false zero-disclosures or empty-window claim', () => {
  const html=renderScope('all','rahul','2026-10-21T10:00:00+05:30',false,true,{expandedRunupDate:'22/10/2026',runupError:'Pre-result filings could not load. Please retry.'});
  assert.match(html,/Retry pre-result filings/);assert.doesNotMatch(html,/0 Disclosures Found|No separate corporate filings recorded/);
});


test('shared Telegram actions stay admin-only and Details has an accessible dialog and close control', () => {
  const regular=renderScope('all','rahul','2026-10-21T10:00:00+05:30',false,true);
  assert.doesNotMatch(regular,/Dispatch to Telegram|Telegram Alert|Broadcast to Telegram/);
  assert.match(regular,/aria-label="Close calendar details"/);assert.match(regular,/role="dialog"/);
  assert.match(renderScope('all','rahul','2026-10-21T10:00:00+05:30',false,true,{},true),/Dispatch to Telegram/);
});


test('shared company calendar link searches the exact BSE code across date tabs on entry', () => {
  const html=renderScope('all','rahul','2026-10-21T10:00:00+05:30',false,false,{},false,'?scrip=500325');
  assert.match(html,/value="500325"/);assert.match(html,/Reliance Industries Ltd/);assert.doesNotMatch(html,/Vishal Mega Mart Limited/);
  const invalid=renderScope('all','rahul','2026-10-21T10:00:00+05:30',false,false,{},false,'?scrip=wrong');
  assert.match(invalid,/Vishal Mega Mart Limited/);
});
