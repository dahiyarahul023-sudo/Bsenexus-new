import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { pageItems } from '../../src/shared/companyFilings.js';

// Exercise the actual component callbacks and commit effects, without claiming browser layout evidence.
function componentHarness(path: string, extra: Record<string, any> = {}) {
  const requireActual = createRequire(new URL(`../../${path}`, import.meta.url));
  const react = requireActual('react');
  const states: any[] = [], refs: any[] = [], effects: (() => void)[] = [];
  let stateIndex = 0, refIndex = 0;
  const fakeReact = { ...react,
    useState(value: any) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof value === 'function' ? value() : value;
      return [states[index], (next: any) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useRef(value: any) { const index = refIndex++; return refs[index] ??= { current: value }; },
    useMemo(fn: () => any) { return fn(); },
    useCallback(fn: any) { return fn; },
    useEffect() {},
    useLayoutEffect(fn: () => void) { effects.push(fn); },
  };
  const ListPagination = () => null;
  const exports: any = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { exports, console, Date, ...extra, require(name: string) {
    if (name === 'react') return fakeReact;
    if (name.endsWith('/AuthContext')) return { useAuth: () => ({ user: null, profile: null }) };
    if (name.endsWith('/IntelModalContext')) return { useIntelModal: () => ({}) };
    if (name.endsWith('/aiQuota')) return { useAiQuota: () => ({}) };
    if (name.endsWith('/companyIntelSnapshots')) return { readCompanyIntelSnapshot: () => null };
    if (name.endsWith('/useForegroundRefresh')) return { useForegroundRefresh() {} };
    if (name.endsWith('/useBodyScrollLock')) return { useBodyScrollLock() {} };
    if (name.endsWith('/useVisibilityInterval')) return { useVisibilityInterval() {} };
    if (name.endsWith('/useUnreadNotificationCount')) return { useUnreadNotificationCount: () => ({ count: 0 }) };
    if (name.endsWith('/unreadNotificationCount')) return { notificationCountOwner: () => null };
    if (name.endsWith('/companyFilings')) return { pageItems };
    if (name.endsWith('/ListPagination')) return { ListPagination };
    if (name.endsWith('/cashfree')) return { getLowestPlanPrice: () => 89 };
    if (name.endsWith('/timeFormat')) return { formatShortDateTime: () => '22 Oct 2026' };
    if (name.endsWith('/cleanBseSubject') || name.endsWith('/pdfHelper')) return requireActual(name + '.ts');
    if (name.endsWith('/storyData')) return { getStorySessionStorageKey: () => 'story-test' };
    if (name.endsWith('/safeStorage')) return requireActual(name + '.ts');
    if (name.startsWith('.')) return {};
    return requireActual(name);
  } });
  return { states, refs, ListPagination,
    render(name: string, props: any) {
      stateIndex = 0; refIndex = 0; effects.length = 0;
      return exports[name](props);
    },
    commit() { effects.splice(0).forEach(effect => effect()); },
  };
}

function nodes(element: any): any[] {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!element || typeof element !== 'object' || !element.props) return [];
  return [element, ...nodes(element.props.children)];
}

test('actual company filing Next and Previous commit new rows before resetting the sole scroll owner and focus', () => {
  const harness = componentHarness('src/components/CompanyIntelligenceModal.tsx');
  const props = { isOpen: true, scripCode: '532424', symbol: 'GODREJCP', onClose() {} };
  harness.render('CompanyIntelligenceModal', props);
  harness.states[0] = 'filings';
  harness.states[2] = { _selectionKey: 'guest:532424:GODREJCP', recentFilings: Array.from({ length: 60 }, (_, i) => ({
    id: `filing-${i}`, subject: `Filing ${i}`, timestamp: Date.parse('2026-10-22T10:00:00Z'),
  })) };
  harness.states[3] = false;
  let tree = nodes(harness.render('CompanyIntelligenceModal', props));
  const body = tree.find(node => node.props.ref && /overflow-y-auto/.test(node.props.className || ''));
  const heading = tree.find(node => node.type === 'h3' && node.props.ref);
  assert.ok(body && heading);
  const scroller = { scrollTop: 700 }, focusCalls: any[] = [];
  body.props.ref.current = scroller;
  heading.props.ref.current = { focus: (options: any) => focusCalls.push(options.preventScroll) };
  harness.commit();
  assert.equal(scroller.scrollTop, 700, 'ordinary renders must not reset the reader');
  for (const [page, subject] of [[2, 'Filing 25'], [1, 'Filing 0']] as const) {
    const pagination = tree.find(node => node.type === harness.ListPagination);
    pagination.props.onPage(page);
    assert.equal(scroller.scrollTop, 700, 'reset waits for the new page commit');
    tree = nodes(harness.render('CompanyIntelligenceModal', props));
    assert.ok(tree.some(node => node.props.children === subject), 'the new page rows are rendered');
    assert.equal(tree.filter(node => /overflow-y-auto/.test(node.props.className || '')).length, 1, 'no nested filing scrollbox');
    harness.commit();
    assert.equal(scroller.scrollTop, 0);
    scroller.scrollTop = 700;
  }
  assert.deepEqual(focusCalls, [true, true]);
});

test('round logo opens Story while brand title uses For You and its active-page scroll/refresh owner', () => {
  const changes: string[] = [], events: any[] = [], scrolls: any[] = [];
  const window = { scrollY: 0, dispatchEvent: (event: any) => events.push(event), scrollTo: (options: any) => scrolls.push(options) };
  const harness = componentHarness('src/components/Layout.tsx', { window, localStorage: { getItem: () => null },
    CustomEvent: class { constructor(public type: string, public options: any) {} },
  });
  const props = { children: null, activeTab: 'dashboard', onTabChange: (tab: string) => changes.push(tab), theme: 'light', setTheme() {}, onLogout() {} };
  const render = (activeTab: string) => nodes(harness.render('Layout', { ...props, activeTab }));
  let tree = render('dashboard');
  const logo = tree.find(node => node.props['aria-label'] === "View Today's Market Story (Daily Highlights)");
  assert.equal(logo.props.type, 'button');
  logo.props.onClick();
  tree = render('dashboard');
  assert.ok(tree.some(node => node.props.isOpen && node.props.onStoryViewed), 'the existing Story viewer is opened');
  assert.deepEqual(changes, [], 'Story access must not navigate to For You');
  const title = tree.find(node => node.props['aria-label'] === 'BSE Nexus home — For You');
  assert.equal(title.props.type, 'button');
  title.props.onClick();
  assert.deepEqual(changes, ['home']);
  assert.equal(events.length, 0);
  tree = render('home');
  const home = tree.find(node => node.props['aria-label'] === 'BSE Nexus home — For You');
  home.props.onClick();
  assert.equal(events[0].type, 'bse_nav_tab_refresh');
  assert.equal(events[0].options.detail.tab, 'home');
  window.scrollY = 800;
  home.props.onClick();
  assert.equal(scrolls[0].top, 0);
  assert.equal(events.length, 1);
});
