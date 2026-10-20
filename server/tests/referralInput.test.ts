import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReferralInput, formatReferralLink } from '../../src/utils/referralInput.js';
import { ReferralCodeField } from '../../src/components/ui/ReferralCodeField.js';
import { renderToStaticMarkup } from 'react-dom/server';

test('Rahul full links and plain codes resolve to the same complete alias', () => {
  const code = 'RAHULDAH_6C93BAE8';
  for (const input of [code, code.toLowerCase(), ` ${code} `,
    `https://bsenexus.in/?ref=${code}`, `HTTPS://BSENEXUS.IN/?REF=${code}`,
    `bsenexus.in/?ref=${code}`, `https://www.bsenexus.in/?ref=${code.toLowerCase()}&utm_source=share#plans`,
    `https://bsenexus.in/?ref=RAHULDAH%5F6C93BAE8`]) {
    assert.equal(parseReferralInput(input), code, input);
  }
  const link = formatReferralLink(code);
  assert.equal(link, 'https://bsenexus.in/?ref=rahuldah_6c93bae8');
  assert.equal(parseReferralInput(link), code);
});

test('complete candidates are validated without clipping or stripping into another alias', () => {
  for (const invalid of ['', 'ab', 'a'.repeat(21), 'alice bob', 'alice/123', 'aliçe', 'ßabc',
    'https://bsenexus.in/', 'HTTPS://BSENEXUS.IN/',
    'https://bsenexus.in/?ref=', 'https://bsenexus.in/?ref=alice&ref=bobby',
    'https://bsenexus.in/?ref=alice&REF=bobby',
    'https://example.com/?ref=alice', 'https://bsenexus.in.evil.test/?ref=alice',
    'https://bsenexus.in@evil.test/?ref=alice', 'https://user@bsenexus.in/?ref=alice',
    'https://bsenexus.in:3000/?ref=alice', 'javascript:alice',
    'https://bsenexus.in/?ref=alice%2F123', 'https://bsenexus.in/?ref=alice%252D123',
    `https://bsenexus.in/?ref=alice&padding=${'x'.repeat(2048)}`]) {
    assert.equal(parseReferralInput(invalid), null, invalid.slice(0, 120));
  }
  assert.equal(parseReferralInput('a'.repeat(20)), 'A'.repeat(20));
  assert.equal(parseReferralInput('ab-c_123'), 'AB-C_123');
});

test('shared checkout field preserves typing and intercepts full link paste before native insertion', () => {
  let value = ''; let prevented = false;
  const field = ReferralCodeField({ value, disabled: false, inputRef: { current: null }, onChange: next => { value = next; } });
  field.props.onChange({ target: { value: 'rahulDah' } });
  assert.equal(value, 'rahulDah');
  field.props.onPaste({ clipboardData: { getData: () => 'https://bsenexus.in/?ref=RAHULDAH_6C93BAE8' },
    preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(value, 'rahuldah_6c93bae8');
  assert.equal(parseReferralInput(value), 'RAHULDAH_6C93BAE8');
  assert.equal(field.props.maxLength, undefined);
  assert.equal(field.props.autoCapitalize, 'none');
  assert.equal(field.props.autoCorrect, 'off');
  assert.match(renderToStaticMarkup(field), /aria-label="Referral code or link"/);
});

test('invalid paste is preserved for correction and produces no guessed identity', () => {
  let changed = false; let prevented = false;
  const field = ReferralCodeField({ value: '', disabled: false, inputRef: { current: null }, onChange: () => { changed = true; } });
  field.props.onPaste({ clipboardData: { getData: () => 'https://example.com/?ref=alice' },
    preventDefault: () => { prevented = true; } });
  assert.equal(changed, false);
  assert.equal(prevented, false);
});
