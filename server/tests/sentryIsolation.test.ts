import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('server/sentry.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function initialize(env: Record<string, string>) {
  const exports: Record<string, any> = {};
  const calls: any[] = [];
  vm.runInNewContext(source, {
    exports, process: { env }, console: { log() {}, warn() {} },
    require(name: string) {
      if (name === '@sentry/node') return { init: (options: any) => calls.push(options) };
      if (name.endsWith('aiTelemetry.js')) return { redactAiTelemetry: (event: any) => event };
      throw Error(`Unexpected import: ${name}`);
    },
  });
  exports.initServerSentry();
  exports.initServerSentry();
  return calls;
}

test('SSR imports under a test runner never initialize an external monitoring transport', () => {
  assert.equal(initialize({ NODE_ENV: 'test' }).length, 0);
  assert.equal(initialize({ TEST_RUNNER: '1' }).length, 0);
  assert.equal(initialize({ NODE_ENV: 'production', NODE_TEST_CONTEXT: 'child-v8' }).length, 0);
});

test('production monitoring still initializes once with the configured DSN and redaction', () => {
  const calls = initialize({ NODE_ENV: 'production', SENTRY_DSN: 'configured-project-dsn' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].dsn, 'configured-project-dsn');
  assert.equal(calls[0].environment, 'production');
  assert.equal(calls[0].traceLifecycle, 'static', 'Sentry 11 must actually execute the transaction redactor');
  assert.equal(typeof calls[0].beforeSend, 'function');
  assert.equal(typeof calls[0].beforeSendTransaction, 'function');
});
