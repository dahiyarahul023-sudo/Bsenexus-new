import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {resolveConfig} from 'vite';
import {disabledHmrClient} from '../../scripts/vite-preview-client.mjs';

test('static preview prepares every browser runtime import before serving React', async () => {
  const config = await resolveConfig({}, 'serve');
  assert.equal(config.optimizeDeps.noDiscovery, true);
  const prepared = new Set(config.optimizeDeps.include);
  const missing = new Set<string>();
  const visitFile = (file: string) => {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const check = (specifier: string) => {
      if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('@/') && !prepared.has(specifier)) missing.add(`${file}: ${specifier}`);
    };
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly && ts.isStringLiteral(node.moduleSpecifier)) check(node.moduleSpecifier.text);
      if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) check(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) check(node.arguments[0].text);
      ts.forEachChild(node, visit);
    };
    visit(source);
  };
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.[jt]sx?$/.test(file)) visitFile(file);
    }
  };
  walk('src');
  assert.deepEqual([...missing], [], 'Add each new browser dependency to optimizeDeps.include; never discover a second React graph mid-session.');
});

test('disabled HMR client preserves Vite exports but never connects; enabled HMR is untouched', () => {
  const require = createRequire(import.meta.url);
  const id = path.join(path.dirname(require.resolve('vite/package.json')), 'dist/client/client.mjs');
  const source = readFileSync(id, 'utf8');
  const plugin = disabledHmrClient();
  plugin.configResolved({server: {hmr: false}});
  const result = plugin.transform(source, id);
  assert.ok(result);
  assert.ok(!result.code.includes('transport.connect(createHMRHandler(handleMessage));'));
  assert.equal(result.code.match(/export \{[^}]+\}/g)?.at(-1), source.match(/export \{[^}]+\}/g)?.at(-1));
  assert.equal(plugin.transform(source, '/src/App.tsx'), null);
  assert.throws(() => plugin.transform('changed upstream client', id), /Vite client changed/);
  plugin.configResolved({server: {hmr: {}}});
  assert.equal(plugin.transform(source, id), null);
});
