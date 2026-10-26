import { personalStoryChapters } from '../../src/utils/forYou';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

function nodes(value: any): any[] { return Array.isArray(value) ? value.flatMap(nodes) : value?.props ? [value, ...nodes(value.props.children)] : []; }
function harness(file: string, auth: any) {
  const actual = createRequire(new URL('../../' + file, import.meta.url));
  const react = actual('react'); const states: any[] = [], refs: any[] = []; let stateIndex = 0, refIndex = 0;
  const fake = { ...react, useState(value: any) { const i = stateIndex++; if (!(i in states)) states[i] = typeof value === 'function' ? value() : value; return [states[i], (next: any) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; }, useRef(value: any) { return refs[refIndex++] ??= { current: value }; }, useEffect() {}, useMemo: (fn: any) => fn(), useCallback: (fn: any) => fn };
  const slides = ['one', 'two'].map(id => ({ id, chapterId: 'market-pulse', title: 'Source-backed story', layout: 'news', subject: { kind: 'topic' }, source: { name: 'Source' } }));
  const chapters = [{ id: 'market-pulse', slides }]; const exports: any = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, document: { body: {}, hidden: false }, performance: { now: () => 10 }, setTimeout: () => 1, clearTimeout() {}, require(name: string) {
    if (name === 'react') return fake;
    if (name === 'react-dom') return { createPortal: (tree: any) => tree };
    if (name === 'framer-motion') return { useReducedMotion: () => false };
    if (name.endsWith('/forYou')) return {personalStoryChapters};
    if (name.endsWith('/AuthContext')) return { useAuth: () => auth };
    if (name.endsWith('/storyData')) return { getInitialStoryChapters: () => chapters, getAllSlides: () => slides };
    if (name.endsWith('/storyBuilder')) return { resolveStorySelection: () => ({ activeId: 'one', missingTopic: false }), getStoryDuration: () => 10000 };
    if (name.endsWith('/storyTypes')) return { STORY_TOPICS: [] };
    if (name.endsWith('/useBodyScrollLock')) return { useBodyScrollLock() {} };
    if (name.endsWith('.css')) return {};
    if (name.startsWith('.')) return new Proxy({}, { get: (_target, key) => key === '__esModule' ? false : () => null });
    return actual(name);
  } });
  return { render(name: string, props = {}) { stateIndex = 0; refIndex = 0; return nodes(exports[name](props)); } };
}

test('actual Story viewer respects on/off/default and still handles tap navigation when buttons are hidden', () => {
  const auth = { user: { uid: 'owner' }, profile: { uid: 'owner', notificationPreferences: {} as any } };
  const h = harness('src/components/TodayMarketStoryModal.tsx', auth);
  const props = { isOpen: true, onClose() {} };
  assert.ok(h.render('TodayMarketStoryModal', props).some(node => node.props['aria-label'] === 'Story navigation'));
  auth.profile.notificationPreferences.storyNavigationButtons = false;
  let tree = h.render('TodayMarketStoryModal', props);
  assert.ok(!tree.some(node => node.props['aria-label'] === 'Story navigation'));
  const main = tree.find(node => node.type === 'main');
  const event = { button: 0, pointerId: 1, clientX: 290, clientY: 100, target: { closest: () => null }, currentTarget: { scrollTop: 0, setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, width: 320 }) } };
  main.props.onPointerDown(event); main.props.onPointerUp(event);
  tree = h.render('TodayMarketStoryModal', props);
  assert.ok(tree.some(node => node.props.slide?.id === 'two'), 'side tap advances without bottom buttons');
  auth.user.uid = 'other';
  assert.ok(h.render('TodayMarketStoryModal', props).some(node => node.props['aria-label'] === 'Story navigation'), 'old owner preference cannot control next account');
});

test('actual Settings preference uses the existing save owner and reports failed saves, not false success', async () => {
  const calls: any[] = [];
  const auth = { user: { uid: 'owner' }, profile: { uid: 'owner', notificationPreferences: {} }, updateNotificationPreferences: async (patch: any) => { calls.push(patch); return false; } };
  const h = harness('src/components/story/StoryNavigationPreference.tsx', auth);
  let tree = h.render('StoryNavigationPreference');
  const control = tree.find(node => node.props.label === 'Story navigation buttons');
  assert.equal(control.props.checked, true); control.props.onChange(false);
  await new Promise(resolve => setImmediate(resolve));
  tree = h.render('StoryNavigationPreference');
  assert.equal(calls.length, 1); assert.equal(calls[0].storyNavigationButtons, false);
  assert.ok(tree.some(node => node.props.children === 'Could not save. Please retry.'));
  assert.ok(!tree.some(node => node.props.children === 'Story preference saved.'));
});
