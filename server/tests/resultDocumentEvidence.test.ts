import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkResultDocument } from '../services/resultDocumentEvidence.js';
import { cachedResultDocumentCheck, isVerifiedResultFiling, archiveCompletionMessage } from '../../src/shared/resultFiling.js';
import { importHistoricalFilings } from '../services/historicalFilings.js';

const time = Date.parse('2026-10-25T00:00:00Z');
const generic = { newsId: 'chola', scrip_cd: '511243', subject: 'Outcome Of Board Meeting', details: 'Outcome of Board Meeting',
  pdfLink: 'https://www.bseindia.com/xml-data/corpfiling/AttachLive/f63092b1-9a6c-4aaa-b9bd-4787e138eed3.pdf' };
const approval = 'BSE Limited Scrip Code 511243. The Board of Directors at its meeting today considered and approved the unaudited standalone and consolidated financial results for the quarter and nine months ended 31 December, 2025. These results are enclosed.';
const response = async () => new Response('%PDF-1.7 fixture only');

test('generic Cholafin-style title needs identity-bound PDF proof; original identity, PDF and release clock remain authoritative', async () => {
  assert.equal(isVerifiedResultFiling(generic), false);
  const proof = await checkResultDocument(generic, { request: response, extract: async () => approval, now: () => time });
  assert.ok(proof); assert.equal(proof.scripCode, '511243'); assert.match(proof.excerpt, /31 December, 2025/);
  const saved = { ...generic, id: generic.newsId, resultDocumentCheck: proof };
  assert.equal(isVerifiedResultFiling(saved), true);
  for (const altered of [{ scrip_cd: '500696' }, { pdfLink: 'https://example.com/filing.pdf' }, { id: 'another' },
    { resultDocumentCheck: { ...proof, documentSha256: 'invalid' } }]) {
    assert.equal(cachedResultDocumentCheck({ ...saved, ...altered }), null);
    assert.equal(isVerifiedResultFiling({ ...saved, ...altered }), false);
  }
  assert.equal(isVerifiedResultFiling({ ...saved, subject: 'Board Meeting Intimation', details: 'to consider financial results' }), false);
  assert.equal(isVerifiedResultFiling({ ...saved, subject: 'Investor Presentation - Outcome of Board Meeting' }), false);
});

test('bare approved financial results are recognized without requiring an audited adjective twice', async () => {
  const proof = await checkResultDocument(generic, { request: response, extract: async () => approval.replace('considered and approved the unaudited standalone and consolidated', 'approved the') });
  assert.equal(proof?.verdict, 'result');
});

test('wrong company, unreadable PDF, generic non-financial outcome and failed source never fabricate evidence', async () => {
  await assert.rejects(checkResultDocument(generic, { request: response, extract: async () => approval.replace('511243','500696') }), /identity/);
  await assert.rejects(checkResultDocument(generic, { request: async () => new Response('<html>unavailable</html>'), extract: async () => approval }), /not a PDF/);
  await assert.rejects(checkResultDocument(generic, { request: async () => new Response('', { status: 403 }) }), /unavailable/);
  await assert.rejects(checkResultDocument(generic, { request: response, extract: async () => 'Scrip Code 511243. '.repeat(10) + 'The Board approved appointment of a new director.' }), /further verification/);
  assert.equal(await checkResultDocument({ ...generic, pdfLink: 'https://example.com/a.pdf' }, { request: async () => { throw new Error('must not fetch'); } }), null);
});

async function runImport(verify: typeof checkResultDocument, existing: any[] = []) {
  const saved: any[] = []; let unverified = 0, first = '';
  await importHistoricalFilings('511243',1,()=>{}, {
    now: () => time, existing: async () => existing, pause: async () => {}, verify, unverified: () => unverified++,
    request: async (url: any) => {
      const p = new URL(url).searchParams; first ||= p.get('strPrevDate')!;
      return Response.json({ Table: p.get('strPrevDate') === first && p.get('pageno') === '1'
        ? [{ NEWSID:generic.newsId,SCRIP_CD:'511243',NEWSSUB:generic.subject,HEADLINE:generic.details,ATTACHMENTNAME:generic.pdfLink.split('/').at(-1),News_submission_dt:'2026-01-30T17:31:21' }] : [] });
    }, save: async (items: any[]) => { saved.push(...items); return { total:items.length,inserted:items.length,updated:0,skipped:0 }; },
    confirm: async (ids: string[]) => assert.deepEqual(ids,[generic.newsId]),
  });
  return { saved, unverified };
}

test('archive persists reusable proof with original filing and warns on unavailable PDFs while retaining their links', async () => {
  const proof = await checkResultDocument(generic, { request: response, extract: async () => approval });
  const result = await runImport(async () => proof);
  assert.equal(result.unverified,0); assert.equal(isVerifiedResultFiling(result.saved[0]),true);
  const retry = await runImport(async () => { throw new Error('cached proof must avoid another download'); }, result.saved);
  assert.equal(retry.unverified,0); assert.deepEqual(retry.saved[0].resultDocumentCheck,proof);
  const failed = await runImport(async () => { throw new Error('source unavailable'); });
  assert.equal(failed.saved.length,1); assert.equal(failed.unverified,1);
  assert.equal(isVerifiedResultFiling(failed.saved[0]),false); assert.equal(failed.saved[0].pdfLink,generic.pdfLink);
  assert.match(archiveCompletionMessage({ processed:1,years:1,unverifiedDocuments:1 }),/still need result verification/);
});

test('existing filing gains proof even when its headline and PDF have not changed; ordinary reimports retain it', async () => {
  const { saveAnnouncementsBatch, getAnnouncementsForScrip } = await import('../database/announcementDao.js');
  const item = { ...generic,newsId:'result-proof-persistence-test',companyName:'Cholamandalam',bseTime:'2026-01-30T17:31:21',priority:'MEDIUM',category:'BOARD_MEETING' };
  await saveAnnouncementsBatch([item]);
  const proof = await checkResultDocument(item, {request:response,extract:async()=>approval});
  assert.ok(proof);
  assert.equal((await saveAnnouncementsBatch([{...item,resultDocumentCheck:proof}])).updated,1);
  await saveAnnouncementsBatch([item]);
  const stored = (await getAnnouncementsForScrip('511243')).find(r=>r.id===item.newsId);
  assert.deepEqual(stored.resultDocumentCheck,proof);assert.equal(isVerifiedResultFiling(stored),true);
});

test('a pre-existing filing ID does not confirm that newly attached proof was durably saved', async () => {
  const { readFileSync } = await import('node:fs'); const vm = await import('node:vm'); const ts = await import('typescript');
  const shared = await import('../../src/shared/resultFiling.js'); const matching = await import('../../src/shared/scripMatching.js'); const { parseBseDate } = await import('../utils/helpers.js');
  const proof = await checkResultDocument(generic,{request:response,extract:async()=>approval});
  const source = ts.transpileModule(readFileSync('server/services/historicalFilings.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports: any = {};
  vm.runInNewContext(source,{exports,Date,process,AbortSignal,URLSearchParams,Map,Set,console,require(path:string) {
    if (path.endsWith('/resultFiling.js')) return shared;
    if (path.endsWith('/scripMatching.js')) return matching;
    if (path.endsWith('/helpers.js')) return {parseBseDate,determinePriority:()=>({level:'MEDIUM',category:'BOARD_MEETING'})};
    if (path.endsWith('/httpDeadline.js')) return {withHttpDeadline:async(fn:any)=>fn(new AbortController().signal)};
    if (path.endsWith('/supabase.js')) return {isSupabaseConfigured:()=>true,getSupabase:()=>({from() {const q:any={select:()=>q,in:()=>q,abortSignal:async()=>({data:[{id:generic.newsId,data:{}}],error:null})};return q;}})};
    if (path.endsWith('/announcementDao.js')) return {flushSupabaseWriteQueue:async()=>{}};
    return {};
  }});
  await assert.rejects(exports.importHistoricalFilings('511243',1,()=>{}, {now:()=>time,existing:async()=>[],pause:async()=>{},verify:async()=>proof,
    request:async()=>Response.json({Table:[{NEWSID:generic.newsId,SCRIP_CD:'511243',NEWSSUB:generic.subject,ATTACHMENTNAME:generic.pdfLink.split('/').at(-1),News_submission_dt:'2026-01-30T17:31:21'}]}),
    save:async()=>({total:1,inserted:0,updated:1,skipped:0})}),/Result evidence storage confirmation pending/);
});
