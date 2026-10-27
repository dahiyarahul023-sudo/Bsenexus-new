import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { summarizeLoadTimes } from '../../src/shared/performanceSummary.ts';

// Exercise the actual summary projection with an isolated retained-event store.
// No diagnostics files, provider calls or production notifications are touched.
const source = ts.createSourceFile('diagnosticsDao.ts', fs.readFileSync(new URL('../database/diagnosticsDao.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'getDiagnosticsSummary');
assert.ok(declaration);
async function summary(events: any[]) {
  const context: any = {
    exports: {},
    getStore: () => ({ events, stats: {} }),
    isErrorApprovedOrMuted: () => false,
    getBloomFilterDiagnostics: () => ({}),
    summarizeLoadTimes,
  };
  vm.runInNewContext(ts.transpileModule(declaration.getText(source) + '\nexports.read = getDiagnosticsSummary;', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports.read();
}
const visit = (performance: any) => ({ type: 'PERFORMANCE', performance, device: { type: 'MOBILE' } });
const error = { type: 'ERROR', error: { message: 'Example failure' }, device: { type: 'MOBILE' } };

test('legacy visits still count for error rates while their potentially synthetic timings stay excluded', async () => {
  const result = await summary([...Array.from({ length: 100 }, () => visit({ pageLoadTimeMs: 450 })), error]);
  assert.equal(result.systemHealth.totalPageViews, 100);
  assert.equal(result.systemHealth.crashFreeRate, 99);
  assert.equal(result.systemHealth.status, 'OPTIMAL');
  assert.equal(result.systemHealth.loadSamples, 0);
  assert.equal(result.systemHealth.averageLoadTimeMs, null);
});

test('view population and measured timing population remain separate across mixed versions', async () => {
  const result = await summary([
    ...Array.from({ length: 100 }, () => visit({ pageLoadTimeMs: 450 })),
    visit({ measurementVersion: 2, pageLoadTimeMs: 70000 }),
    visit({ measurementVersion: 2, ttfbMs: 50 }),
    { type: 'WEB_VITAL', performance: { lcpMs: 2000 } }, error,
  ]);
  assert.equal(result.systemHealth.totalPageViews, 102);
  assert.equal(result.systemHealth.crashFreeRate, 99); // Existing one-decimal percentage contract.
  assert.equal(result.systemHealth.loadSamples, 1);
  assert.equal(result.systemHealth.averageLoadTimeMs, 70000);
  assert.equal(result.systemHealth.p95LoadTimeMs, 70000);
});
