import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { runWithAdminElevation } from '../../src/utils/adminElevation.js';

function declaration(file: string, name: string) {
  const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  let found: ts.VariableDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found = node;
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.ok(found, name);
  return ts.transpileModule(`export const ${found.getText(ast)};`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
}
function modal(context: any) {
  const react = { createElement: (type: any, props: any, ...children: any[]) => ({ type, props: { ...props, children } }),
    useState: (initial: any) => [initial === '' ? 'fixture-pin' : initial, () => {}],
    useEffect: () => {}, useRef: (current: any) => ({ current }) };
  const exports: any = {};
  const source = ts.transpileModule(fs.readFileSync('src/components/AdminPinModal.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
  vm.runInNewContext(source, { exports, document: { activeElement: null }, require: (path: string) => {
    if (path === 'react') return { ...react, default: react };
    if (path.includes('AuthContext')) return { useAuth: () => context };
    if (path.includes('usePaymentDialog')) return { usePaymentDialog: () => ({ current: null }) };
    return {};
  } });
  return exports.AdminPinModal();
}
function find(node: any, type: string): any {
  if (!node || typeof node !== 'object') return null;
  if (node.type === type) return node;
  for (const child of (node.props?.children || []).flat(Infinity)) { const result = find(child, type); if (result) return result; }
  return null;
}
for (const [file, name, args] of [
  ['src/components/AiUsageCard.tsx', 'handleAdminResetAll', []],
  ['src/components/SettingsTab.tsx', 'handleResetAllQuotas', []],
  ['src/components/StorageManager.tsx', 'handleResetAiQuota', ['all']],
  ['src/components/StorageManager.tsx', 'handleResetAiQuota', ['user']],
] as const) {
  test(`${name} ${args}: explicit 403 opens the actual PIN modal; confirmed PIN retries reset once`, async () => {
    let calls = 0, prompts = 0, refreshes = 0, finish!: (value: boolean) => void, opened!: () => void;
    const openedPromise = new Promise<void>(r => { opened = r; });
    const context: any = { isAdmin: true, isAdminPinModalOpen: false, user: { uid: 'owner', email: 'dahiyarahul023@gmail.com' },
      setIsAdminPinModalOpen: () => finish(false), verifyAdminPin: async () => { context.isAdminPinModalOpen = false; finish(true); return { success: true }; } };
    const request = () => { prompts++; context.isAdminPinModalOpen = true; opened(); return new Promise<boolean>(r => { finish = r; }); };
    const exports: any = {}; const feedback: any[] = [];
    const noOp = () => {};
    vm.runInNewContext(declaration(file, name), {
      exports, isAdmin: true, targetUserInput: 'target-user',
      runElevatedAdminAction: (action: () => Promise<Response>) => runWithAdminElevation(action, () => true, request, () => true),
      customFetch: async (url: string, options: RequestInit) => {
        calls++; assert.equal(url, '/api/billing/reset-quota');
        const payload = JSON.parse(String(options.body));
        assert.equal(payload.target, args[0] || 'all'); if (args[0] === 'user') assert.equal(payload.uid, 'target-user');
        return calls === 1 ? Response.json({ success: false, adminElevationRequired: true }, { status: 403 }) : Response.json({ success: true, resetCount: 2, message: '2 records reset' });
      },
      setIsResetting: noOp, setIsResettingAllQuotas: noOp, setIsResettingQuota: noOp, setTargetUserInput: noOp,
      setResetFeedback: (v: any) => feedback.push(v), setResetAllQuotaFeedback: (v: any) => feedback.push(v), setQuotaResetFeedback: (v: any) => feedback.push(v),
      window: { dispatchEvent: (event: Event) => { assert.equal(event.type, 'bse_ai_quota_refresh'); refreshes++; } }, Event, setTimeout: noOp,
    });
    const work = exports[name](...args); await openedPromise;
    assert.equal(calls, 1); const rendered = modal(context);
    assert.equal(rendered.props.role, 'dialog'); assert.equal(rendered.props['aria-labelledby'], 'admin-pin-title');
    await find(rendered, 'form').props.onSubmit({ preventDefault() {} }); await work;
    assert.equal(prompts, 1); assert.equal(calls, 2); assert.equal(refreshes, 1);
    assert.match(JSON.stringify(feedback.at(-1)), /2 records reset/);
  });
}

test('PIN precedes reset when unelevated; cancel/account switch never performs the reset', async () => {
  const order: string[] = [];
  await runWithAdminElevation(async () => { order.push('reset'); return Response.json({ success: true }); }, () => false,
    async () => { order.push('pin'); return true; }, () => true);
  assert.deepEqual(order, ['pin', 'reset']);
  for (const [pin, current] of [[false, true], [true, false]]) {
    let writes = 0;
    const response = await runWithAdminElevation(async () => { writes++; return Response.json({}); }, () => false, async () => pin, () => current);
    assert.equal(response, null); assert.equal(writes, 0);
  }
});
test('second elevation denial, HTML 403 and uncertain 503 never cause a reset loop', async () => {
  for (const status of [403, 503]) {
    let calls = 0, prompts = 0;
    const response = await runWithAdminElevation(async () => { calls++; return new Response('<html>error</html>', { status }); },
      () => true, async () => { prompts++; return true; }, () => true);
    assert.equal(response!.status, status); assert.equal(calls, 1); assert.equal(prompts, 0);
  }
  let calls = 0, prompts = 0;
  const response = await runWithAdminElevation(async () => { calls++; return Response.json({ adminElevationRequired: true }, { status: 403 }); },
    () => true, async () => { prompts++; return true; }, () => true);
  assert.equal(response!.status, 403); assert.equal(calls, 2); assert.equal(prompts, 1);
});

test('an account switch during the single retry discards the old reset response', async () => {
  let current = true, calls = 0;
  const response = await runWithAdminElevation(async () => {
    if (++calls === 1) return Response.json({ adminElevationRequired: true }, { status: 403 });
    current = false; return Response.json({ success: true });
  }, () => true, async () => true, () => current);
  assert.equal(response, null); assert.equal(calls, 2);
});
