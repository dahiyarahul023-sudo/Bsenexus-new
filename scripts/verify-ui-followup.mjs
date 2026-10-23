// Local visual QA: render the actual toolbar JSX and public-company renderer without API writes.
// Run after a build: node --import tsx scripts/verify-ui-followup.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as scripMatching from '../src/shared/scripMatching.ts';
import * as exchangeCompanies from '../src/config/exchangeCompanies.ts';
import * as companyDirectory from '../src/config/companyDirectory.ts';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { motion } = require('framer-motion');
const icons = require('lucide-react');
const { clsx } = require('clsx');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const compilerOptions = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX };
function toolbar(file, predicate, values) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let selected;
  const visit = node => {
    if (ts.isJsxElement(node) && predicate(node.openingElement.getText(source))) selected ??= node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!selected) throw Error(`Toolbar not found: ${file}`);
  const context = { exports: {}, require, React, motion, cn: clsx, ...icons, buttonTap: {}, springSnappy: {}, ...values };
  const code = ts.transpileModule(`exports.render = () => (${selected.getText(source)});`, { compilerOptions }).outputText;
  vm.runInNewContext(code, context);
  return renderToStaticMarkup(context.exports.render());
}
const calendar = toolbar('src/components/ResultsCalendar.tsx', text => text.includes('ref={toolbarRef}'), {
  toolbarRef: null, filteredAndSortedItems: Array(22), lastUpdated: Date.parse('2026-10-23T08:15:35+05:30'),
  formatTimeOnly: () => '08:15:35 AM IST', searchQuery: '', calendarScope: 'watchlist', viewMode: 'grid',
  selectedWatchlistId: '', sortBy: 'date_asc', declarationFilter: 'all', statusFilter: 'upcoming',
});
const watchlist = toolbar('src/components/WatchlistManager.tsx', text => text.includes('watchlist-toolbar'), {
  watchlistSubTab: 'companies', myCompaniesList: Array(60), watchlistAnnouncements: Array(140),
  companySearch: '', isAddCompanyOpen: false,
});
const server = ts.createSourceFile('server.ts', read('server.ts'), ts.ScriptTarget.Latest, true);
const names = ['renderCompanyPage', 'escapeHtmlText', 'escapeHtmlAttr'];
const declarations = server.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(server)).join('\n');
const context = { console, getAllStockEntries: () => [], AI_STUDIO_REDIRECT_SCRIPT: '',
  ...scripMatching, ...exchangeCompanies, ...companyDirectory,
};
vm.createContext(context);
vm.runInContext(ts.transpileModule(declarations, { compilerOptions }).outputText, context);
const detail = 'This long source filing explains the quarterly financial results, board approval, standalone and consolidated statements and trading-window dates. '.repeat(12);
const html = context.renderCompanyPage({ companyName: 'Wipro Limited', quarterlyResults: Array.from({ length: 3 }, (_, i) => ({
  scripCode: '507685', quarterKey: `Q${3 - i}FY27`, periodOrMeeting: `Quarter Ended 30-Sep-2026 (Q${3 - i} FY27) (STD & CONSOL)`,
  declarationDate: '15 Oct 2026', status: 'Declared', subject: detail,
  pdfLink: 'https://www.bseindia.com/xml-data/corpfiling/AttachLive/qa-fixture.pdf',
})) }, 'WIPRO', '507685');
const companyStyle = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const companySection = html.match(/<section class="section">\s*<h2 class="section-label">Financial Results[\s\S]*?<\/section>/)[0];
const css = fs.readdirSync(path.join(root, 'dist/assets')).find(file => /^index-.*\.css$/.test(file));
if (!css) throw Error('Build CSS is missing');
const sharedRoot = root.replace('/workspace/scratch/', '/home/oai/share/');
const stylesheet = `file://${sharedRoot}/dist/assets/${css}`;
const escape = value => String(value).replace(/[&"<>]/g, char => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[char]);
const frames = [];
for (const width of [360, 390, 768, 1280]) for (const dark of [false, true]) {
  const toolbarDoc = `<!doctype html><html class="${dark ? 'dark' : ''}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${stylesheet}"></head><body style="margin:0;padding:16px;background:${dark ? '#12131c' : '#f8fafc'}"><main class="space-y-6"><h1 class="text-sm text-slate-500">Actual toolbar JSX · QA fixture</h1>${calendar}<section class="rounded-xl border p-3">${watchlist}</section></main></body></html>`;
  const companyDoc = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${companyStyle}</style></head><body><main class="container"><article class="card">${companySection}</article></main></body></html>`;
  for (const [kind, doc] of [['toolbars', toolbarDoc], ['company', companyDoc]]) {
    if (kind === 'company' && dark) continue;
    frames.push(`<section><h2>${kind} · ${width}px · ${dark ? 'dark' : 'light'}</h2><iframe title="${kind}-${width}-${dark ? 'dark' : 'light'}" width="${width}" height="780" srcdoc="${escape(doc)}"></iframe></section>`);
  }
}
const output = path.resolve(root, '../ui-followup-qa.html');
fs.writeFileSync(output, `<!doctype html><html><head><meta charset="utf-8"><title>BSE Nexus responsive QA</title><style>body{margin:16px;background:#e2e8f0;font:14px system-ui}section{margin:24px 0}h2{font-size:16px}iframe{display:block;border:1px solid #94a3b8;background:white}</style></head><body><h1>Responsive QA · actual source with labelled synthetic fixtures</h1>${frames.join('')}</body></html>`);
console.log(output);
