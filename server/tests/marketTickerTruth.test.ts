import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

function render(snapshot: any) {
  const actual = createRequire(new URL('../../src/components/ui/MarketTickerTape.tsx', import.meta.url));
  const exports: any = {};
  const code = ts.transpileModule(readFileSync('src/components/ui/MarketTickerTape.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require(name: string) {
    if (name.endsWith('/useMarketIndices')) return { useMarketIndices: () => ({ indices: [], loading: false, stale: false, refresh() {}, ...snapshot }) };
    return actual(name);
  } });
  return renderToStaticMarkup(React.createElement(exports.MarketTickerTape));
}

test('empty/loading feeds never manufacture live index prices', () => {
  for (const loading of [false, true]) {
    const html = render({ loading });
    assert.match(html, loading ? /Loading market data/ : /Market data unavailable/);
    assert.doesNotMatch(html, /79,942|24,304|51,820|84\.12/);
    assert.doesNotMatch(html, /BSE\/NSE LIVE/);
  }
});

test('received quotes retain their values and stale label', () => {
  const html = render({ stale: true, indices: [{ id: 'test-index', name: 'Verified index', price: 123.45, change: 1.2, changePercent: 0.98, category: 'EQUITY_INDEX' }] });
  assert.match(html, /Verified index/);
  assert.match(html, /123\.45/);
  assert.match(html, /CACHED \/ STALE/);
});
