import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual server wiring without starting listeners, databases or providers.
const source = readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('server.ts', source, ts.ScriptTarget.Latest, true);
function executeStatement(needle: string, globals: Record<string, unknown>) {
  const statement = ast.statements.find(s => ts.isExpressionStatement(s) && s.getText(ast).includes(needle));
  assert.ok(statement, `missing server wiring: ${needle}`);
  const code = ts.transpileModule(statement.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, globals);
}

test('the container attempts a cycle every 60 seconds, including after a failure and a recent successful fetch', async () => {
  let tick!: () => Promise<void>;
  let calls = 0, radarCalls = 0;
  let interval = 0;
  executeStatement('await processAnnouncements()', {
    trackInterval: (handle: unknown) => handle,
    setInterval: (callback: typeof tick, ms: number) => { tick = callback; interval = ms; },
    refreshRadarIntake: async () => { radarCalls++; },
    processAnnouncements: async () => { calls++; if (calls === 1) throw new Error('offline'); },
    getBseFeedStaleness: () => ({ lastSuccessfulFetchMs: Date.now(), bootMs: Date.now() }),
    Date, console: { warn() {} },
  });
  assert.equal(interval, 60_000);
  await tick();
  await tick();
  assert.equal(calls, 2, 'a recent fetch or a failed tick must not suppress the next minute');
  assert.equal(radarCalls, 2, 'the existing watchdog also triggers source intake without another timer');
});

test('the cron wiring caps source-block/off-hours failure backoff at one minute', () => {
  let deps!: { backoffMs: () => number };
  let failures = 0;
  let block = 0;
  executeStatement("'/api/cron/poll-announcements'", {
    app: { get(_path: string, handler: unknown) { return handler; } },
    createAnnouncementCronHandler: (value: typeof deps) => { deps = value; return () => {}; },
    processAnnouncements() {},
    getConsecutiveFailures: () => failures,
    getBseBlockBackoffLevel: () => block,
    getPollingIntervalMs: () => 303_000,
    Math,
  });
  assert.equal(deps.backoffMs(), 0);
  for (const [failureCount, blockLevel] of [[1, 0], [3, 0], [6, 0], [0, 1], [0, 3]]) {
    failures = failureCount; block = blockLevel;
    assert.equal(deps.backoffMs(), 60_000);
  }
});
