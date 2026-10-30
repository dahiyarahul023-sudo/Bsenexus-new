import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { scriptSafeJson } from '../utils/helpers.js';

// XSS-1 (audit pass 2): JSON.stringify leaves "<" alone, so filing headlines,
// company names or AI summaries containing "</script>" could break out of a
// <script type="application/ld+json"> block on our own origin.
describe('JSON-LD script safety', () => {
  const hostile = { headline: 'Q2 </script><script>alert(1)</script>', note: 'a b', plain: 'Tom & Jerry' };

  test('serialised output cannot close the script element and contains no raw "<"', () => {
    const out = scriptSafeJson(JSON.stringify(hostile, null, 2));
    assert.ok(!/<\/script/i.test(out));
    assert.ok(!out.includes('<'));
  });

  test('output is still valid JSON with the original values', () => {
    const back = JSON.parse(scriptSafeJson(JSON.stringify(hostile)));
    assert.deepStrictEqual(back, hostile);
  });

  test('server-rendered JSON-LD sinks never interpolate unescaped JSON', () => {
    const root = process.cwd();
    for (const file of ['server.ts', 'server/services/seoPrerender.ts']) {
      const src = fs.readFileSync(path.join(root, file), 'utf8');
      // A bare ${jsonLd} line, a raw JSON.stringify(jsonLd...) line, or a raw
      // schemaJson / faqJsonLd interpolation inside a ld+json block is a regression.
      assert.ok(!/^\$\{jsonLd\}\s*$/m.test(src), `${file}: raw \${jsonLd} inside a script block`);
      assert.ok(!/^\$\{JSON\.stringify\(jsonLd[^)]*\)\}\s*$/m.test(src), `${file}: raw JSON.stringify(jsonLd) inside a script block`);
      assert.ok(!/ld\+json">\\n\$\{(options\.schemaJson|faqJsonLd)\}/.test(src), `${file}: raw schema interpolation`);
      assert.ok(!/const jsonString = JSON\.stringify\(options\.jsonLd/.test(src), `${file}: raw options.jsonLd serialisation`);
    }
  });
});
