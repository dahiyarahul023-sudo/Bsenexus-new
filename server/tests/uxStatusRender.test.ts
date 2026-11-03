import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Actual component render with controlled read states; effects/API/providers are isolated.
// This verifies presentation contracts, not interactive/browser or live-provider behaviour.
function component(file: string, state: Record<number, unknown>, auth: object, extra = '') {
  let index = 0;
  const react = { ...React, useState(initial: any) {
    const value = index in state ? state[index] : typeof initial === 'function' ? initial() : initial;
    index++; return [value, () => {}];
  }};
  const source = fs.readFileSync(file, 'utf8') + extra;
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const actual = createRequire(new URL('../../' + file, import.meta.url));
  const exports: any = {};
  vm.runInNewContext(code, { exports, console, require(path: string) {
    if(path === 'react') return { ...react, default: react };
    if(path.endsWith('/AuthContext')) return { useAuth: () => auth };
    if(path.endsWith('/useBodyScrollLock')) return { useBodyScrollLock() {} };
    if(path.endsWith('/useVisibilityInterval')) return { useVisibilityInterval() {} };
    if(path.endsWith('/useForegroundRefresh')) return { useForegroundRefresh() {} };
    if(path.endsWith('/usePaymentDialog')) return { usePaymentDialog() {} };
    if(path.endsWith('/IntelModalContext')) return { useIntelModal: () => ({ openIntelModal() {} }) };
    if(path.endsWith('/aiQuota')) return { useAiQuota: () => ({ canGenerate: true }) };
    if(path.endsWith('/SaveNoteButton')) return { SaveNoteButton: () => null };
    if(path.endsWith('/PaymentHistory')) return { PaymentHistory: () => null };
    if(path.endsWith('.css')) return {};
    if(path.endsWith('/api')) return {};
    return actual(path);
  }});
  return exports;
}
const auth = { user: { uid: 'fixture' }, profile: { uid: 'fixture' }, isPro: true, isAdmin: true };
const inboxProps = { isOpen: true, onClose() {}, onOpenCompanyIntel() {}, onOpenAlertRules() {}, unreadCount: 0, onRefreshCount() {}, onBeginRead: () => () => {} };

test('failed cold inbox renders one retryable failure, never a successful empty state', () => {
  const { NotificationInbox } = component('src/components/NotificationInbox.tsx', { 1: 'Notifications could not be loaded. Please retry.' }, auth);
  const html = renderToStaticMarkup(React.createElement(NotificationInbox, inboxProps));
  assert.ok(html.includes('Retry notifications'));
  assert.equal((html.match(/role="alert"/g) || []).length, 1);
  assert.ok(!html.includes('No Notifications'));
  assert.ok(!html.includes('No saved notifications'));
  assert.ok(!html.includes('Loading notifications'));
});
test('confirmed empty inbox is distinct from a failed refresh of an empty snapshot', () => {
  const snapshot = { owner: 'fixture', views: { ALL: [] } };
  const good = component('src/components/NotificationInbox.tsx', { 5: snapshot }, auth).NotificationInbox;
  assert.ok(renderToStaticMarkup(React.createElement(good, inboxProps)).includes('No Notifications'));
  const failed = component('src/components/NotificationInbox.tsx', { 1: 'Unavailable', 5: snapshot }, auth).NotificationInbox;
  const html = renderToStaticMarkup(React.createElement(failed, inboxProps));
  assert.ok(html.includes('Retry notifications')); assert.ok(!html.includes('No Notifications'));
});
test('administrator billing never combines active access with expired-trial progress', () => {
  const status = { configured: true, isPro: true, proExpiresAt: 1, lastPaymentAt: null, plan: { label: 'Pro Monthly', validityDays: 30, amountPaise: 29900 } };
  const { TestCard } = component('src/components/SubscriptionCard.tsx', { 0: status, 1: false }, auth, '\nexport const TestCard = SubscriptionCardContent;');
  const html = renderToStaticMarkup(React.createElement(TestCard));
  assert.ok(html.includes('Administrator access')); assert.ok(html.includes('No expiry'));
  assert.ok(!html.includes('Pro Trial')); assert.ok(!html.includes('Access period ended')); assert.ok(!html.includes('Upgrade to Pro'));
});
test('company Hub presents declared evidence instead of a scheduled catalyst', () => {
  const intel = { _selectionKey: 'fixture:500112:SBIN', companyName: 'State Bank of India', symbol: 'SBIN', scripCode: '500112', recentFilings: [{ id: 'result', subject: 'Quarterly financial results', timestamp: Date.now() }], materialTimeline: [], quarterlyResults: [],
    upcomingEvent: { purpose: 'Results', meetingDate: '2026-11-03', countdownDays: 0, isDeclared: true } };
  for(const declared of [true, false]) {
    const { CompanyIntelligenceModal } = component('src/components/CompanyIntelligenceModal.tsx', { 2: { ...intel, upcomingEvent: { ...intel.upcomingEvent, isDeclared: declared } }, 3: false }, auth);
    const html = renderToStaticMarkup(React.createElement(CompanyIntelligenceModal, { isOpen: true, scripCode: '500112', symbol: 'SBIN', companyName: 'State Bank of India', onClose() {} }));
    assert.ok(html.includes(declared ? 'Latest result' : 'Next Catalyst'));
    assert.ok(html.includes(declared ? 'Declared' : 'Scheduled'));
    assert.ok(!html.includes(declared ? 'Scheduled' : 'Latest result'));
  }
});
