import { directoryDescription, directoryBadge } from '../../src/config/companyDirectory.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { injectRouteHeading, PUBLIC_ROUTE_HEADINGS } from '../utils/routeHeading.js';
import { PageHeading } from '../../src/components/ui/PageHeading.js';

const template = fs.readFileSync('index.html', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const ast = ts.createSourceFile('server.ts', server, ts.ScriptTarget.Latest, true);
const selected = ast.statements.filter(node => {
  if (ts.isFunctionDeclaration(node)) return node.name?.text === 'injectTabSeoMetadata';
  return ts.isVariableStatement(node) && node.declarationList.declarations.some(d =>
    ts.isIdentifier(d.name) && ['TAB_SEO_CONFIG', 'TAB_ALIASES'].includes(d.name.text));
}).map(node => node.getText(ast)).join('\n');
const context: any = { directoryDescription, directoryBadge, injectRouteHeading, escapeHtmlAttr: (s: string) => String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;'), escapeHtmlText: (s: string) => s };
vm.runInNewContext(ts.transpileModule(selected, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, context);
const h1s = (html: string) => html.match(/<h1(?:\s|>)/gi) || [];

for (const [route, heading] of Object.entries(PUBLIC_ROUTE_HEADINGS)) {
  test(`${route}: the actual initial document/metadata owner provides one visible H1 without JavaScript`, () => {
    const html = context.injectTabSeoMetadata(template, route === 'default' ? undefined : route);
    assert.equal(h1s(html).length, 1);
    assert.ok(html.includes(heading.replaceAll('&', '&amp;')));
    assert.match(html, /<h1 class="app-boot-heading">/);
    assert.equal(h1s(context.injectTabSeoMetadata(html, route)).length, 1, 'a second metadata pass cannot duplicate the heading');
    assert.match(html, /<link rel="canonical" href="https:\/\/bsenexus.in\//);
  });
}

test('announcements retains its real feed marker/cards and does not add another H1 when filings are present', () => {
  const html = context.injectTabSeoMetadata(template, 'announcements').replace('<!--announcements-feed-->', '<section><h2>Latest disclosures</h2><article>Official filing</article></section>');
  assert.equal(h1s(html).length, 1); assert.match(html, /Official filing/);
  assert.match(html, /href="https:\/\/bsenexus.in\/announcements"/);
});

test('other route renderers retain their ownership; templates without the marker are untouched', () => {
  const standalone = '<main><h1>Privacy Policy</h1></main>';
  assert.equal(injectRouteHeading(standalone, 'plugin'), standalone);
  assert.equal(h1s(injectRouteHeading(template, 'results-calendar')).length, 0, 'calendar replaces the root with its own source-backed H1');
});

test('only the active retained screen has an H1 across Home, Filings and Watchlist switches', () => {
  for (const current of ['home', 'dashboard', 'watchlists']) {
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
      ...['home', 'dashboard', 'watchlists'].map(page => React.createElement('section', { key: page, hidden: current !== page },
        React.createElement(PageHeading, { active: current === page }, page)))));
    assert.equal(h1s(html).length, 1); assert.ok(html.includes(`<h1>${current}</h1>`));
    assert.equal((html.match(/<h2>/g) || []).length, 2, 'inactive screens remain mounted with lower-level headings');
  }
});

test('watchlist content and denied-access title both use the same single-heading primitive without changing controls', () => {
  for (const title of ['Your Stock Watchlist', 'Watchlists are a Pro feature']) {
    const html = renderToStaticMarkup(React.createElement(PageHeading, { className: 'existing-title' }, title));
    assert.equal(h1s(html).length, 1); assert.ok(html.includes(title)); assert.match(html, /class="existing-title"/);
  }
});
