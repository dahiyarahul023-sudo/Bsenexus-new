import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkPerformanceBudget, checkPublicPageBudget } from '../../scripts/check-performance-budget.mjs';

function fixture(run: (directory: string) => void) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-budget-'));
  fs.mkdirSync(path.join(directory, '.vite'));
  const manifest = {
    'index.html': { file: 'entry.js', isEntry: true, imports: ['shared'], dynamicImports: ['dialog'] },
    shared: { file: 'shared.js', imports: ['cycle'] },
    cycle: { file: 'cycle.js', imports: ['shared'] },
    dialog: { file: 'dialog.js', isDynamicEntry: true },
  };
  fs.writeFileSync(path.join(directory, '.vite/manifest.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(directory, 'entry.js'), 'a'.repeat(60));
  fs.writeFileSync(path.join(directory, 'shared.js'), 'b'.repeat(60));
  fs.writeFileSync(path.join(directory, 'cycle.js'), 'c'.repeat(20));
  fs.writeFileSync(path.join(directory, 'dialog.js'), 'd'.repeat(50_000));
  try { run(directory); } finally { fs.rmSync(directory, { recursive: true }); }
}

test('startup budget includes shared static dependencies once and excludes a closed lazy dialog', () => fixture(directory => {
  const result = checkPerformanceBudget(directory, { raw: 150, gzip: 1000 }, ['dialog']);
  assert.equal(result.raw, 140);
  assert.equal(result.files.length, 3);
  assert.throws(() => checkPerformanceBudget(directory, { raw: 100, gzip: 1000 }, ['dialog']), /exceeds/);
}));

test('the compressed-size gate cannot be bypassed by passing the raw-size gate', () => fixture(directory => {
  assert.throws(() => checkPerformanceBudget(directory, { raw: 1000, gzip: 1 }, ['dialog']), /exceeds/);
}));

test('public budget includes the landing static closure and rejects eager demos', () => fixture(directory => {
  const file = path.join(directory, '.vite/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  manifest['src/components/LandingPage.tsx'] = {file:'home.js',isDynamicEntry:true,imports:['index.html']};
  manifest['src/components/landing/LandingExamples.tsx'] = {file:'examples.js',isDynamicEntry:true};
  fs.writeFileSync(path.join(directory,'home.js'),'h'.repeat(60));
  fs.writeFileSync(path.join(directory,'examples.js'),'e'.repeat(100));
  fs.writeFileSync(file,JSON.stringify(manifest));
  assert.equal(checkPublicPageBudget(directory,{raw:210,gzip:1000}).raw,200);
  assert.throws(()=>checkPublicPageBudget(directory,{raw:199,gzip:1000}),/exceeds/);
  manifest['src/components/LandingPage.tsx'].imports.push('src/components/landing/LandingExamples.tsx');
  fs.writeFileSync(file,JSON.stringify(manifest));
  assert.throws(()=>checkPublicPageBudget(directory,{raw:1000,gzip:1000}),/outside the initial/);
}));

test('missing manifests, dependency files and an eagerly reintroduced dialog fail closed', () => fixture(directory => {
  const manifestPath = path.join(directory, '.vite/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest['index.html'].imports.push('dialog');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.throws(() => checkPerformanceBudget(directory, { raw: 100000, gzip: 100000 }, ['dialog']), /outside the initial/);
  manifest['index.html'].imports.pop();
  manifest['index.html'].imports.push('missing');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.throws(() => checkPerformanceBudget(directory, { raw: 100000, gzip: 100000 }, []), /Missing manifest/);
  manifest['index.html'].imports.pop();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  fs.unlinkSync(path.join(directory, 'shared.js'));
  assert.throws(() => checkPerformanceBudget(directory, { raw: 100000, gzip: 100000 }, []), /ENOENT/);
}));
