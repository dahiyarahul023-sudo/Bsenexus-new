import { test } from 'node:test';
import assert from 'node:assert/strict';
import { telegramResultIdentity, isValidTelegramResultSummary } from '../utils/telegramResultPolicy.js';
import { deliverTelegramResultSummary } from '../services/telegramResultSummary.js';
import { isAllowedExchangeDocumentUrl, isAllowedBseDocumentUrl, fetchExchangeDocument } from '../utils/bseDocument.js';

const base = { company: 'Union Bank of India', scripCode: '532477', category: 'RESULTS',
  subject: 'Unaudited Reviewed Financial Results for the Quarter / Half Year ended on September 30, 2026', details: '',
  source: 'bse-a', chatId: 'admin-test', lang: 'english' as const };
const valid = '📊 RESULTS ANALYSIS — Consolidated quarter ended 30 September 2026\nRevenue (Total Income): ₹30,958.46 Cr versus ₹28,105.26 Cr.\nPAT (Net Profit): ₹4,720.01 Cr versus ₹3,511.42 Cr.\nRevenue and profit increased year on year.';

function store() {
  const rows = new Map<string, any>();
  return { rows,
    async claim(key: string, kind: string, source: string, token: string) {
      const previous = rows.get(key);
      if (previous && !(previous.status === 'failed' && previous.source !== source && previous.attempts < 2)) return { acquired: false, row: previous };
      const row = { kind, status: 'processing', source, claim_token: token, attempts: (previous?.attempts || 0) + 1, value: {} };
      rows.set(key, row); return { acquired: true, row };
    },
    async read(key: string) { return rows.get(key) || null; },
    async finish(key: string, token: string, status: string, value = {}) {
      const row = rows.get(key);
      if (!row || row.claim_token !== token || row.status !== 'processing') return false;
      rows.set(key, { ...row, status, value }); return true;
    },
  };
}

test('company/quarter identity joins BSE and NSE copies, but never guesses an unknown period', () => {
  assert.equal(telegramResultIdentity(base), 'results:532477:2026-09-30');
  assert.equal(telegramResultIdentity({ ...base, subject: 'Financial results for the period ended 30/09/2026' }), telegramResultIdentity(base));
  assert.equal(telegramResultIdentity({ ...base, subject: 'Financial results for the period ended 30th September 2026' }), telegramResultIdentity(base));
  for (const date of ['30-Sep-2026', 'Sep 30, 2026', '2026-09-30']) assert.equal(telegramResultIdentity({ ...base, subject: 'Financial results for the quarter ended ' + date }), telegramResultIdentity(base));
  for (const subject of ['Board meeting intimation to consider financial results on September 30, 2026', 'Publication of financial results for the quarter ended September 30, 2026', 'Financial results announced', 'Financial results for the quarter ended February 30, 2026']) assert.equal(telegramResultIdentity({ ...base, subject }), null);
});

test('all non-results categories use zero summary claims, model calls or replies', async () => {
  const storage = store(); let calls = 0;
  for (const category of ['CONFERENCE_CALL','MATERIAL_EVENT','CORPORATE_ACTION','OTHER']) {
    assert.equal(await deliverTelegramResultSummary({ ...base, category }, { store: storage, generate: async () => { calls++; return valid; }, send: async () => { calls++; return { success: true }; } }), 'ineligible');
  }
  assert.equal(calls, 0); assert.equal(storage.rows.size, 0);
});

test('rejects the observed missing-document/template/all-unavailable replies, accepts a real numerical result', () => {
  assert.equal(isValidTelegramResultSummary(valid), true);
  for (const text of [valid + '\nPlease provide the text or upload the document', valid + '\n₹[Current] Cr vs ₹[YoY] Cr (+X.X%)', valid.replaceAll(/[\d,.]+/g, 'Not available in filing'), 'INSUFFICIENT_RESULT_DATA', 'Fast Filing Summary: Revenue ₹100 Cr and PAT ₹10 Cr. ' + valid]) assert.equal(isValidTelegramResultSummary(text), false);
});

test('concurrent same-quarter copies and subsequent reloads generate/send only once for one chat', async () => {
  const storage = store(); let generations = 0, sends = 0;
  const deps = { store: storage, generate: async () => { generations++; return valid; }, send: async () => { sends++; return { success: true, messageId: 1 }; } };
  const results = await Promise.all(['bse-a','nse-a','bse-b'].map(source => deliverTelegramResultSummary({ ...base, source }, deps)));
  assert.equal(results.filter(x => x === 'sent').length, 1);
  assert.equal(await deliverTelegramResultSummary({ ...base, source: 'republication' }, deps), 'duplicate');
  assert.equal(generations, 1); assert.equal(sends, 1);
});

test('a new recipient shares ready analysis, while next-quarter results get a new summary', async () => {
  const storage = store(); let generations = 0, sends = 0;
  const deps = { store: storage, generate: async () => { generations++; return valid; }, send: async () => { sends++; return { success: true }; } };
  await deliverTelegramResultSummary(base, deps);
  await deliverTelegramResultSummary({ ...base, chatId: 'another-test', source: 'nse-b' }, deps);
  assert.equal(generations, 1); assert.equal(sends, 2);
  await deliverTelegramResultSummary({ ...base, subject: base.subject.replace('September 30, 2026', 'December 31, 2026'), source: 'next-quarter' }, deps);
  assert.equal(generations, 2); assert.equal(sends, 3);
});

test('failed evidence never sends a reply and a new attachment can recover; same source does not burn quota again', async () => {
  const storage = store(); let generations = 0, sends = 0; let text = 'Please upload the document';
  const deps = { store: storage, generate: async () => { generations++; return text; }, send: async () => { sends++; return { success: true }; } };
  assert.equal(await deliverTelegramResultSummary(base, deps), 'invalid');
  await deliverTelegramResultSummary(base, deps); assert.equal(generations, 1); assert.equal(sends, 0);
  text = valid;
  assert.equal(await deliverTelegramResultSummary({ ...base, source: 'real-new-pdf' }, deps), 'sent');
  assert.equal(generations, 2); assert.equal(sends, 1);
});

test('unknown Telegram acceptance never resends after a new duplicate filing or language change', async () => {
  const storage = store(); let sends = 0;
  const deps = { store: storage, generate: async () => valid, send: async () => { sends++; throw new Error('timeout after acceptance'); } };
  await assert.rejects(deliverTelegramResultSummary(base, deps));
  assert.equal(await deliverTelegramResultSummary({ ...base, source: 'bse-b', lang: 'hinglish' }, deps), 'duplicate');
  assert.equal(sends, 1);
});

test('unavailable durable storage fails closed before using AI or sending', async () => {
  let calls = 0;
  const storage = store(); storage.claim = async () => { throw new Error('DB offline'); };
  await assert.rejects(deliverTelegramResultSummary(base, { store: storage, generate: async () => { calls++; return valid; }, send: async () => { calls++; return { success: true }; } }));
  assert.equal(calls, 0);
});

test('lost post-send receipt writes retain the reservation rather than sending a second reply', async () => {
  const storage=store();let sends=0;const finish=storage.finish;
  storage.finish=async(key,token,status,value)=>{
    if(key.includes(':delivery:'))throw new Error('receipt write offline');
    return finish(key,token,status,value);
  };
  const deps={store:storage,generate:async()=>valid,send:async()=>{sends++;return {success:true,messageId:123};}};
  await assert.rejects(deliverTelegramResultSummary(base,deps));
  assert.equal(await deliverTelegramResultSummary({...base,source:'another-copy'},deps),'duplicate');
  assert.equal(sends,1);
});

test('NSE PDF support is exact and never expands the existing BSE-only proxy allowlist', async () => {
  assert.equal(isAllowedExchangeDocumentUrl('https://nsearchives.nseindia.com/corporate/UNIONBANK.pdf'), true);
  assert.equal(isAllowedBseDocumentUrl('https://nsearchives.nseindia.com/corporate/UNIONBANK.pdf'), false);
  for (const url of ['https://nsearchives.nseindia.com.evil.test/corporate/x.pdf','http://nsearchives.nseindia.com/corporate/x.pdf','https://nsearchives.nseindia.com:444/corporate/x.pdf','https://nsearchives.nseindia.com/not-a-filing/x.pdf','https://user:pass@nsearchives.nseindia.com/corporate/x.pdf']) assert.equal(isAllowedExchangeDocumentUrl(url), false);
  const original = global.fetch; let calls = 0;
  global.fetch = (async () => { calls++; return new Response('', { status: 302, headers: { location: 'http://169.254.169.254/private' } }); }) as typeof fetch;
  try { await assert.rejects(fetchExchangeDocument('https://nsearchives.nseindia.com/corporate/x.pdf'), /Only official/); assert.equal(calls, 1); }
  finally { global.fetch = original; }
});
