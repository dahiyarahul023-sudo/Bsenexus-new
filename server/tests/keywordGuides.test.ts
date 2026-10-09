import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { KEYWORD_GUIDES, getKeywordGuide, KEYWORD_GUIDE_CSS } from '../../src/content/keywordGuides.js';
import { getMarketGuideBySlug, getIndexableMarketGuides, FALLBACK_MARKET_GUIDES } from '../services/marketGuidesService.js';

// Run the real server renderer without starting providers, background jobs or notifications.
const source = readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');
const tree = ts.createSourceFile('server.ts', source, ts.ScriptTarget.Latest, true);
const node = tree.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === 'renderGuidePage');
assert.ok(node, 'server guide renderer exists');
const rendererCode = ts.transpileModule(node.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const context = vm.createContext({ getKeywordGuide, KEYWORD_GUIDE_CSS, escapeHtmlText: escape, escapeHtmlAttr: escape, getRelatedCompaniesForGuide: () => [], AI_STUDIO_REDIRECT_SCRIPT: '' });
vm.runInContext(rendererCode, context);

for (const guide of KEYWORD_GUIDES) {
  test(`${guide.slug}: full server-rendered article, metadata and visible/schema FAQ parity`, () => {
    assert.equal(getMarketGuideBySlug(guide.slug), guide);
    // Equivalent entity encodings differ between the Markdown compiler and SSR helpers.
    const html: string = context.renderGuidePage(guide).replace(/&#x27;/g, '&#39;');
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.ok(html.includes(`<title>${escape(guide.title)}</title>`));
    assert.ok(html.includes(`<meta name="description" content="${escape(guide.summary)}">`));
    assert.ok(html.includes(`href="https://bsenexus.in/guides/${guide.slug}"`));
    assert.ok(html.includes('content="noindex, follow"'));
    assert.ok(html.includes('Editorial draft'));
    assert.equal((guide.articleHtml.match(/<h2>/g) || []).length, 7);
    assert.ok(html.includes('<table>') && html.includes('<th scope="col">') && html.includes('<th scope="row">'));
    assert.ok(html.includes('[VERIFY'));
    assert.ok(!html.includes('undefined'));
    const schemas = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)].map(match => JSON.parse(match[1]));
    const article = schemas.find(schema => schema['@type'] === 'Article');
    const faq = schemas.find(schema => schema['@type'] === 'FAQPage');
    assert.equal(article.author['@type'], 'Organization');
    assert.equal(article.datePublished, undefined, 'draft has no invented publication date');
    assert.equal(faq.mainEntity.length, 8);
    for (const item of faq.mainEntity) {
      assert.ok(html.includes(`<h3>${escape(item.name)}</h3>`));
      assert.ok(html.includes(`<p>${escape(item.acceptedAnswer.text)}</p>`));
    }
    if (guide.slug === 'bse-announcements-api') {
      assert.ok(html.includes('<pre tabindex="0" aria-label="python code example"><code>'));
      assert.ok(html.includes('response.raise_for_status()'));
    }
    const doc = readFileSync(new URL(`../../docs/guides/DRAFT-${guide.slug}-2026-10-09.md`, import.meta.url), 'utf8');
    for (const match of doc.matchAll(/\[([^\]]+)\]\((https:\/\/bsenexus\.in\/[^)]*)\)/g)) {
      assert.ok(html.includes(`<a href="${escape(match[2])}">${escape(match[1])}</a>`));
    }
  });
}

test('review drafts remain resolvable but never enter search discovery', () => {
  const indexable = getIndexableMarketGuides();
  assert.ok(indexable.length > 0);
  for (const guide of KEYWORD_GUIDES) assert.ok(!indexable.some(item => item.slug === guide.slug));
  assert.equal(indexable.length, FALLBACK_MARKET_GUIDES.length);
  const legacy = context.renderGuidePage(FALLBACK_MARKET_GUIDES[0]);
  assert.ok(legacy.includes('content="index, follow"'));
  assert.ok(legacy.includes(`${escape(FALLBACK_MARKET_GUIDES[0].title)} | Bsenexus`));
  assert.ok(!legacy.includes('Editorial draft'));
});
