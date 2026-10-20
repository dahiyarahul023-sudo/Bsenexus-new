import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const out = path.resolve(process.argv[2] || 'docs/audit');
const skipped = new Set(['node_modules', '.git', 'dist', 'data', 'audit']);
const paths = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipped.has(entry.name) || entry.isSymbolicLink()) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else paths.push(path.relative(root, p).replaceAll('\\', '/'));
  }
}
walk(root);
const files = [], edges = [], routes = [], controls = [], network = [], stores = [], env = [];
const candidates = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '/index.ts', '/index.tsx', '/index.js'];
function resolveImport(file, spec) {
  if (!spec.startsWith('.') && !spec.startsWith('@/')) return null;
  let base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : path.resolve(root, path.dirname(file), spec);
  const variants = [base];
  if (/\.jsx?$/.test(base)) variants.push(base.replace(/\.jsx?$/, '.ts'), base.replace(/\.jsx?$/, '.tsx'));
  for (const b of variants) for (const suffix of candidates) {
    const p = b + suffix;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return path.relative(root, p).replaceAll('\\', '/');
  }
  return null;
}
for (const file of paths.sort()) {
  const bytes = fs.readFileSync(path.join(root, file));
  const text = bytes.toString('utf8');
  const binary = /\.(png|ico|woff2|jpg|jpeg|pdf)$/i.test(file);
  const item = { path: file, bytes: bytes.length, lines: binary ? null : text.split(/\r?\n/).length, kind: path.extname(file).slice(1), imports: [], exports: [] };
  files.push(item);
  if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : file.endsWith('jsx') ? ts.ScriptKind.JSX : undefined);
  const loc = n => source.getLineAndCharacterOfPosition(n.getStart(source)).line + 1;
  const compact = n => n.getText(source).replace(/\s+/g, ' ').slice(0, 450);
  function addImport(node, spec, type) {
    const target = resolveImport(file, spec);
    const entry = { file, line: loc(node), specifier: spec, target, type, resolved: target !== null || (!spec.startsWith('.') && !spec.startsWith('@/')) };
    item.imports.push(entry);
    if (target) edges.push({ source: file, target, line: entry.line, type });
  }
  function visit(n) {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteralLike(n.moduleSpecifier)) addImport(n, n.moduleSpecifier.text, ts.isExportDeclaration(n) ? 'reexport' : 'static');
    if (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || n.expression.getText(source) === 'require') && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) addImport(n, n.arguments[0].text, 'dynamic');
    if (n.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) && n.name) item.exports.push({ name: n.name.getText(source), line: loc(n) });
    if (ts.isCallExpression(n)) {
      const expr = n.expression.getText(source);
      const prop = ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text : null;
      if (prop && ['get', 'post', 'put', 'patch', 'delete', 'all', 'use'].includes(prop) && /(?:app|router)$/i.test(n.expression.expression.getText(source))) {
        routes.push({ file, line: loc(n), router: n.expression.expression.getText(source), method: prop.toUpperCase(), path: n.arguments[0] ? compact(n.arguments[0]) : '', middleware: n.arguments.slice(1).map(a => ts.isArrowFunction(a) || ts.isFunctionExpression(a) ? '<handler>' : compact(a)), endLine: source.getLineAndCharacterOfPosition(n.end).line + 1 });
      }
      if (['fetch', 'customFetch', 'fetchBseDocument'].includes(expr) || /(?:api|axios)\.(get|post|put|patch|delete|request)$/.test(expr)) network.push({ file, line: loc(n), function: expr, target: n.arguments[0] ? compact(n.arguments[0]) : '', options: n.arguments[1] ? compact(n.arguments[1]) : '' });
      if (prop && ['from', 'collection', 'doc', 'setItem', 'getItem', 'removeItem'].includes(prop)) stores.push({ file, line: loc(n), function: expr, key: n.arguments[0] ? compact(n.arguments[0]) : '' });
    }
    if (ts.isPropertyAccessExpression(n) && /^(?:process\.env|import\.meta\.env)$/.test(n.expression.getText(source))) env.push({ file, line: loc(n), name: n.name.text });
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName.getText(source);
      const attrs = {};
      for (const a of n.attributes.properties) if (ts.isJsxAttribute(a)) attrs[a.name.getText(source)] = a.initializer ? compact(a.initializer) : 'true';
      if (['button', 'a', 'input', 'select', 'textarea', 'form'].includes(tag) || Object.keys(attrs).some(k => /^on(Click|Submit|Change|KeyDown)$/.test(k)) || /Button|Dropdown|Modal|Checkout|PlanCard/.test(tag)) {
        const parent = n.parent;
        const label = ts.isJsxElement(parent) ? parent.children.filter(ts.isJsxText).map(c => c.text.trim()).filter(Boolean).join(' ').slice(0, 180) : '';
        controls.push({ id: `UI-${controls.length + 1}`, file, line: loc(n), tag, label, attrs });
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(source);
}
const reverse = {};
for (const e of edges) (reverse[e.target] ||= []).push(e.source);
for (const f of files) f.importedBy = [...new Set(reverse[f.path] || [])].sort();
const inventory = { generatedAt: new Date().toISOString(), head: process.env.AUDIT_BASE_SHA || 'working-tree', limitations: ['Static extraction is a map, not proof that a control works.', 'Computed imports, HTTP URLs, runtime dependencies and SSR HTML require manual verification.', 'Viewport emulation is not real-device certification.'], counts: { files: files.length, textLines: files.reduce((a, f) => a + (f.lines || 0), 0), sourceFiles: files.filter(f => /\.[cm]?[jt]sx?$/.test(f.path)).length, importEdges: edges.length, routes: routes.filter(r => r.method !== 'USE').length, mounts: routes.filter(r => r.method === 'USE').length, controls: controls.length, networkCalls: network.length, storeCalls: stores.length, envNames: new Set(env.map(e => e.name)).size, unresolvedImports: files.flatMap(f => f.imports).filter(i => !i.resolved).length }, files, edges, routes, controls, network, stores, env };
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'inventory.json'), JSON.stringify(inventory, null, 2));
const q = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
fs.writeFileSync(path.join(out, 'file-register.csv'), ['path,kind,lines,bytes,imports,imported_by,review_status', ...files.map(f => [f.path, f.kind, f.lines, f.bytes, f.imports.length, f.importedBy.join('; '), 'mapped; manual review pending'].map(q).join(','))].join('\n'));
fs.writeFileSync(path.join(out, 'route-register.csv'), ['file,line,router,method,path,middleware', ...routes.map(r => [r.file, r.line, r.router, r.method, r.path, r.middleware.join('; ')].map(q).join(','))].join('\n'));
fs.writeFileSync(path.join(out, 'control-register.csv'), ['id,file,line,tag,label,handlers,disabled,href', ...controls.map(c => [c.id, c.file, c.line, c.tag, c.label || c.attrs['aria-label'] || c.attrs.title || '', Object.entries(c.attrs).filter(([k]) => /^on/.test(k)).map(([k, v]) => `${k}=${v}`).join('; '), c.attrs.disabled, c.attrs.href].map(q).join(','))].join('\n'));
console.log(JSON.stringify(inventory.counts));
if (process.argv[3]) {
  const start = process.argv[3], seen = new Set([start]), queue = [start];
  while (queue.length) for (const p of reverse[queue.shift()] || []) if (!seen.has(p)) { seen.add(p); queue.push(p); }
  console.log(JSON.stringify({ changedFile: start, affectedFiles: [...seen].sort(), affectedRoutes: routes.filter(r => seen.has(r.file)), affectedControls: controls.filter(c => seen.has(c.file)).map(({ attrs, ...c }) => c) }, null, 2));
}
