import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as contract from '../../src/shared/impactRadar.js';
test('actual card renders an accessible neutral event with independent detail and tracking controls', () => {
  const source = fs.readFileSync('src/components/ImpactRadar.tsx', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const actualRequire = createRequire(new URL('../../src/components/ImpactRadar.tsx', import.meta.url));
  const exports: any = {};
  vm.runInNewContext(code, { exports, console, require(path: string) {
    if (path.endsWith('/impactRadar')) return contract;
    if (path === './ui/ActionButton') return actualRequire(path);
    if (path.startsWith('.')) return {};
    return actualRequire(path);
  } });
  const event = { id: 'case-1', title: 'Supreme Court hearing scheduled for the company', companies: [{ symbol: 'TCS', name: 'Tata Consultancy Services', scripCode: '532540' }], category: 'liability', authority: 'Supreme Court', status: 'scheduled', scheduledDate: '2026-10-17', scheduleConfirmed: true, source: { kind: 'disclosure' }, publishedAt: '2026-10-15T10:00:00Z' };
  const props = { event, tracked: false, saving: false, disabled: false, now: Date.parse('2026-10-16T12:00:00Z'), selected: false, onOpen() {}, onTrack() {} };
  const html = renderToStaticMarkup(React.createElement(exports.RadarCard, props));
  assert.ok(html.startsWith('<article')); assert.ok(html.includes('Tomorrow')); assert.ok(html.includes('Company disclosure')); assert.ok(html.includes('Track event'));
  assert.ok(html.includes('aria-expanded="false"')); assert.ok(html.includes('aria-pressed="false"')); assert.equal((html.match(/<button/g) || []).length, 2);
  assert.ok(!/bullish|bearish|price target|expected return/i.test(html));
  const tracked = renderToStaticMarkup(React.createElement(exports.RadarCard, { ...props, tracked: true, saving: true }));
  assert.ok(tracked.includes('Saving')); assert.ok(tracked.includes('disabled=""')); assert.ok(tracked.includes('aria-pressed="true"'));
  const reported = renderToStaticMarkup(React.createElement(exports.RadarCard, { ...props, event: { ...event, title: 'Independent report alleges accounting irregularities', source: {kind:'report',name:'Original research publisher'} } }));
  assert.ok(reported.includes('Independent report')); assert.ok(reported.includes('Original research publisher'));
  assert.ok(reported.includes('Tata Consultancy Services: Independent report'));
  assert.ok(!reported.includes('Official source'));
});

test('Home Radar renders only two previews and keeps the full dashboard out of the document until opened', () => {
  const source = fs.readFileSync('src/components/ImpactRadar.tsx', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const actualRequire = createRequire(new URL('../../src/components/ImpactRadar.tsx', import.meta.url));
  const events = Array.from({ length: 10 }, (_, i) => ({ id: `event-${i}`, title: `Supreme Court matter ${i}`, companies: [{ symbol: 'TCS', name: 'Tata Consultancy Services', scripCode: '532540' }], category: 'legal', authority: 'Supreme Court', status: 'monitoring', scheduledDate: null, scheduleConfirmed: false, information: 'Sourced court development.', nextTrigger: null, source: { name: 'BSE', url: 'https://www.bseindia.com/test.pdf', kind: 'disclosure' }, publishedAt: '2026-10-15T10:00:00Z', updatedAt: '2026-10-15T10:00:00Z' }));
  class Feed {
    getSnapshot = () => ({ items: events, following: [], followingReady: true, saving: [], loading: false, checkedAt: Date.now(), error: null });
    subscribe = () => () => {};
  }
  const exports: any = {};
  vm.runInNewContext(code, { exports, console, require(path: string) {
    if (path.endsWith('/impactRadar')) return contract;
    if (path.endsWith('/impactRadarFeed')) return { ImpactRadarFeed: Feed };
    if (path.endsWith('/AuthContext')) return { useAuth: () => ({ setIsAuthModalOpen() {} }) };
    if (path.endsWith('/useVisibilityInterval')) return { useVisibilityInterval() {} };
    if (path === './ui/ActionButton') return actualRequire(path);
    if (path.startsWith('.')) return {};
    return actualRequire(path);
  } });
  const html = renderToStaticMarkup(React.createElement(exports.ImpactRadar, { active: true, identity: 'guest', onNavigate() {}, density: 'standard' }));
  assert.equal((html.match(/<article/g) || []).length, 2);
  assert.ok(html.includes('See more'));
  assert.ok(html.includes('impact-radar-card-open'));
  assert.ok(html.includes('aria-haspopup="dialog"'));
  assert.ok(!html.includes('impact-radar-dashboard-title'));
  assert.ok(!html.includes('Event period'));
});
