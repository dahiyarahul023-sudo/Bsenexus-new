import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// Count every statically imported chunk, not just the entry filename. Splitting
// the same startup work into several chunks must not bypass the budget.
export const STARTUP_BUDGET = { raw: 980_000, gzip: 266_000 };
export const PUBLIC_PAGE_BUDGET = { raw: 900_000, gzip: 250_000 };
export const DEFERRED_FEATURES = [
  'src/components/Layout.tsx',
  'src/components/AuthModal.tsx',
  'src/components/ProUpgradeModal.tsx',
  'src/components/AdminPinModal.tsx',
  'src/components/ProCheckoutView.tsx',
  'src/components/ProReceiptView.tsx',
  'src/components/filing/FilingPage.tsx',
  'src/components/results/ResultsPage.tsx',
  'src/components/notes/NoteEditor.tsx',
];

export function checkPerformanceBudget(directory, limits = STARTUP_BUDGET, deferred = DEFERRED_FEATURES, roots) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, '.vite/manifest.json'), 'utf8'));
  const initial = new Set();
  const visit = key => {
    if (initial.has(key)) return;
    if (!manifest[key]) throw Error(`Missing manifest dependency: ${key}`);
    initial.add(key);
    for (const dependency of manifest[key].imports || []) visit(dependency);
  };
  const entries = roots || Object.keys(manifest).filter(key => manifest[key].isEntry);
  if (!entries.length) throw Error('No entry found in the Vite manifest');
  entries.forEach(visit);
  for (const feature of deferred) {
    if (!manifest[feature]?.isDynamicEntry || initial.has(feature)) {
      throw Error(`${feature} must remain outside the initial static dependency graph`);
    }
  }
  const files = [...new Set([...initial].map(key => manifest[key].file))];
  let raw = 0;
  let gzip = 0;
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(directory, file));
    raw += bytes.length;
    gzip += gzipSync(bytes).length;
  }
  if (raw > limits.raw || gzip > limits.gzip) {
    throw Error(`Startup JavaScript ${raw} raw / ${gzip} gzip bytes exceeds ${limits.raw} / ${limits.gzip}; inspect the static import graph before release`);
  }
  return { raw, gzip, files };
}

export function checkPublicPageBudget(directory, limits = PUBLIC_PAGE_BUDGET) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, '.vite/manifest.json'), 'utf8'));
  const landing = Object.keys(manifest).find(key => key === 'src/components/LandingPage.tsx' || manifest[key].name === 'LandingPage');
  if (!landing) throw Error('Missing LandingPage manifest entry');
  return checkPerformanceBudget(directory, limits,
    ['src/components/landing/LandingExamples.tsx'], [landing]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkPerformanceBudget(path.resolve(process.argv[2] || 'dist'));
  console.log(`Startup budget passed: ${result.raw} raw / ${result.gzip} gzip bytes across ${result.files.length} file(s).`);
  const publicPage = checkPublicPageBudget(path.resolve(process.argv[2] || 'dist'));
  console.log(`Public Home budget passed: ${publicPage.raw} raw / ${publicPage.gzip} gzip bytes across ${publicPage.files.length} file(s).`);
}
