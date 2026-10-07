import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), '..');
const sourcePattern = /\.(?:[cm]?[jt]sx?|json|sql|rules|css|html|txt|xml|webmanifest)$/i;
const codePattern = /\.[cm]?[jt]sx?$/;
const excluded = new Set(['node_modules', '.git', 'dist', 'build', 'data', 'coverage']);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
const slash = value => value.replaceAll('\\', '/');
const sorted = values => [...new Set(values)].sort();

export function sourcePaths(root) {
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(path.join(root, dir))) return;
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (e.isSymbolicLink() || excluded.has(e.name)) continue;
      const p = slash(path.join(dir, e.name));
      if (e.isDirectory()) walk(p);
      else if (sourcePattern.test(p)) files.push(p);
    }
  }
  for (const dir of ['server', 'src', 'scripts', 'supabase', 'public']) walk(dir);
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (e.isFile() && (sourcePattern.test(e.name) || e.name === '.env.example')) files.push(e.name);
  }
  return sorted(files);
}

export function buildMap(root = defaultRoot) {
  const paths = sourcePaths(root);
  const domains = JSON.parse(read(root, 'rule/domains.json')).domains;
  const configFile = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
  if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
  const { options } = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
  const files = [], edges = [], routes = [], network = [], stores = [], environment = [], unresolved = [], dynamic = [];
  const known = new Set(paths);
  function localTarget(file, spec) {
    const resolved = ts.resolveModuleName(spec, path.join(root, file), options, ts.sys).resolvedModule?.resolvedFileName;
    if (resolved && !resolved.includes('/node_modules/')) return slash(path.relative(root, resolved));
    // TypeScript does not resolve assets as modules; preserve literal CSS/JSON imports too.
    if (spec.startsWith('.')) {
      const clean = spec.split('?')[0];
      const target = slash(path.relative(root, path.resolve(root, path.dirname(file), clean)));
      if (known.has(target)) return target;
    }
    return null;
  }
  for (const file of paths) {
    const text = read(root, file);
    files.push({ path: file, sha256: hash(text), importedBy: [] });
    if (!codePattern.test(file)) continue;
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const line = n => ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1;
    const compact = n => n?.getText(ast).replace(/\s+/g, ' ').slice(0, 240) || '';
    const literal = n => n && ts.isStringLiteralLike(n) ? n.text : null;
    function addImport(node, spec, kind) {
      const target = localTarget(file, spec);
      if (target) edges.push({ source: file, target, kind, line: line(node) });
      else if (spec.startsWith('.') || Object.keys(options.paths || {}).some(p => spec.startsWith(p.split('*')[0]))) unresolved.push({ file, line: line(node), specifier: spec });
    }
    function visit(n) {
      if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && literal(n.moduleSpecifier) !== null) addImport(n, literal(n.moduleSpecifier), ts.isExportDeclaration(n) ? 'reexport' : 'import');
      if (ts.isImportEqualsDeclaration(n) && ts.isExternalModuleReference(n.moduleReference) && literal(n.moduleReference.expression) !== null) addImport(n, literal(n.moduleReference.expression), 'require');
      if (ts.isCallExpression(n)) {
        const expr = n.expression.getText(ast);
        const prop = ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text : '';
        if (n.expression.kind === ts.SyntaxKind.ImportKeyword || expr === 'require') {
          const spec = literal(n.arguments[0]);
          if (spec !== null) addImport(n, spec, 'dynamic');
          else dynamic.push({ file, line: line(n), expression: compact(n) });
        }
        if (prop && ['get','post','put','patch','delete','all','use','head','options'].includes(prop) && /(?:app|router)$/i.test(n.expression.expression.getText(ast))) {
          routes.push({ file, line: line(n), receiver: n.expression.expression.getText(ast), method: prop.toUpperCase(), path: literal(n.arguments[0]) ?? compact(n.arguments[0]), middleware: n.arguments.slice(1).map(a => ts.isArrowFunction(a) || ts.isFunctionExpression(a) ? '<handler>' : compact(a)) });
        }
        if (['fetch','customFetch','fetchBseDocument'].includes(expr) || /(?:api|axios)\.(?:get|post|put|patch|delete|request)$/.test(expr)) network.push({ file, line: line(n), function: expr, target: compact(n.arguments[0]) });
        if (['from','rpc','collection','doc','getItem','setItem','removeItem'].includes(prop)) stores.push({ file, line: line(n), function: expr, key: compact(n.arguments[0]) });
      }
      if (ts.isPropertyAccessExpression(n) && /^(?:process\.env|import\.meta\.env)$/.test(n.expression.getText(ast))) environment.push({ file, line: line(n), name: n.name.text });
      if (ts.isElementAccessExpression(n) && /^(?:process\.env|import\.meta\.env)$/.test(n.expression.getText(ast))) environment.push({ file, line: line(n), name: literal(n.argumentExpression) ?? '<computed>' });
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
  const reverse = new Map();
  for (const e of edges) { if (!reverse.has(e.target)) reverse.set(e.target, []); reverse.get(e.target).push(e.source); }
  for (const f of files) f.importedBy = sorted(reverse.get(f.path) || []);
  const invalidDomainPaths = [];
  const ids = new Set();
  for (const d of domains) {
    if (!d.id || ids.has(d.id) || !d.reason || !Array.isArray(d.files) || !Array.isArray(d.tests)) throw new Error('Invalid/duplicate semantic domain: ' + d.id);
    ids.add(d.id);
    for (const p of [...d.files, ...d.tests]) if (!known.has(p)) invalidDomainPaths.push({ domain: d.id, path: p });
  }
  return { schemaVersion: 1, sourceDigest: hash(JSON.stringify({ files: files.map(({path, sha256}) => [path,sha256]), domains })), limitations: ['Static call sites and reviewed domain membership, not a complete runtime graph.', 'Mount middleware, computed references, SQL effects, external systems and production state require manual verification.', 'Candidate tests are not proof of sufficient coverage.'], files, edges, domains, routes, network, stores, environment, unresolved, dynamic, invalidDomainPaths };
}

export function impact(map, changed) {
  const known = new Set(map.files.map(f => f.path));
  for (const p of changed) if (!known.has(p)) throw new Error('Unknown path: ' + p + '. For deleted files inspect the base revision map.');
  const affected = new Set(changed), queue = [...changed];
  const reverse = new Map(map.files.map(f => [f.path, f.importedBy]));
  while (queue.length) for (const p of reverse.get(queue.shift()) || []) if (!affected.has(p)) { affected.add(p); queue.push(p); }
  // Do NOT recursively propagate shared domain membership: that would make almost every change touch everything.
  const domains = map.domains.filter(d => [...d.files,...d.tests].some(p => changed.includes(p)));
  const related = sorted(domains.flatMap(d => d.files));
  const review = new Set([...affected,...related]);
  return { changed, importConsumers: sorted(affected).filter(p => !changed.includes(p)), directDependencies: map.edges.filter(e => changed.includes(e.source)), semanticDomains: domains.map(d => ({id:d.id,reason:d.reason})), relatedFiles: related, candidateTests: sorted([...affected].filter(p => /(?:\.test\.|\.spec\.)/.test(p)).concat(domains.flatMap(d => d.tests))), routes: map.routes.filter(r => review.has(r.file)), stores: map.stores.filter(s => review.has(s.file)), network: map.network.filter(n => review.has(n.file)), environment: map.environment.filter(e => review.has(e.file)), limitations: map.limitations };
}

export function artifacts(map, root = defaultRoot) {
  const json = JSON.stringify(map, null, 2) + '\n';
  // Inline data must never terminate its script element, even if source strings contain HTML.
  const payload = JSON.stringify(map).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
  return { 'spider-map.json': json, 'spider-map.html': read(root, 'scripts/spider-view.html').replace('/*__MAP_DATA__*/null', payload) };
}

function generate(check = false) {
  const map = buildMap();
  if (map.unresolved.length || map.invalidDomainPaths.length) throw new Error(JSON.stringify({unresolved:map.unresolved, invalidDomainPaths:map.invalidDomainPaths},null,2));
  const out = path.join(defaultRoot, 'rule/generated');
  if (!check) fs.mkdirSync(out, {recursive:true});
  for (const [name, content] of Object.entries(artifacts(map))) {
    const target = path.join(out,name);
    if (check) {
      if (!fs.existsSync(target) || fs.readFileSync(target,'utf8') !== content) throw new Error(name + ' is stale. Run npm run map:generate and commit the outputs.');
    } else fs.writeFileSync(target,content);
  }
  console.log(`${check ? 'Verified' : 'Generated'} ${map.files.length} files, ${map.edges.length} import edges, ${map.domains.length} semantic domains; ${map.dynamic.length} computed imports need manual review.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const args = process.argv.slice(2);
  try {
    if (args[0] === '--impact') {
      if (args.length < 2) throw new Error('Usage: npm run map:impact -- <path> [paths]');
      console.log(JSON.stringify(impact(buildMap(),args.slice(1)),null,2));
    } else if (args[0] === '--watch') {
      let previous = '';
      const tick = () => {
        try {
          const signature = hash(sourcePaths(defaultRoot).map(p => p + ':' + hash(read(defaultRoot,p))).join('\n') + read(defaultRoot,'rule/domains.json'));
          if (signature !== previous) { generate(); previous = signature; }
        } catch (error) { console.error(error.message); }
      };
      tick(); setInterval(tick,1500);
      console.log('Watching sources. Refresh the local HTML after a generated update. Ctrl+C stops.');
    } else if (!args.length || args[0] === '--check') generate(args[0] === '--check');
    else throw new Error('Unknown option: ' + args[0]);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
