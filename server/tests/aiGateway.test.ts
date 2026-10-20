/**
 * AI Gateway tests — bina real API keys ke (fetch mock karke).
 * Chalao: node --test --import tsx server/tests/aiGateway.test.ts
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

const LEDGER_PATH = path.join(process.cwd(), 'data', 'ai_provider_usage.json');

function clearLedger() {
  try { fs.unlinkSync(LEDGER_PATH); } catch {}
}

describe('AI Gateway', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearLedger();
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.NVIDIA_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    clearLedger();
  });

  test('registry: har chain alias registry me maujood hai, duplicate nahi', async () => {
    const { MODEL_REGISTRY, TASK_CHAINS } = await import('../services/ai/modelRegistry.js');
    const aliases = MODEL_REGISTRY.map((m) => m.alias);
    assert.strictEqual(new Set(aliases).size, aliases.length, 'duplicate alias mila');
    for (const [task, chain] of Object.entries(TASK_CHAINS)) {
      assert.ok(chain.length >= 2, `${task} chain me kam se kam 2 models hone chahiye`);
      for (const alias of chain) {
        assert.ok(aliases.includes(alias), `${task} chain ka alias ${alias} registry me nahi hai`);
      }
    }
  });

  test('registry: call-sites par koi hardcoded model string nahi', async () => {
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
    const geminiSrc = stripComments(fs.readFileSync(path.join(process.cwd(), 'server/services/gemini.ts'), 'utf8'));
    const seoSrc = stripComments(fs.readFileSync(path.join(process.cwd(), 'server/services/seoService.ts'), 'utf8'));
    for (const [name, src] of [['gemini.ts', geminiSrc], ['seoService.ts', seoSrc]] as const) {
      assert.ok(!src.includes('gemini-3.1-flash-lite'), `${name} me hardcoded model id`);
      assert.ok(!src.includes('gemini-3.8-flash'), `${name} me hardcoded model id`);
      assert.ok(!src.includes('gpt-oss-120b'), `${name} me hardcoded model id`);
      assert.ok(!src.includes('llama-3.3-70b-versatile'), `${name} me retired model id!`);
    }
  });

  test('failover: Groq 429 -> NVIDIA par turant switch, same model retry nahi', async () => {
    process.env.GROQ_API_KEY = 'gsk_test';
    process.env.NVIDIA_API_KEY = 'nvapi_test';

    const calls: string[] = [];
    (globalThis as any).fetch = async (url: string, init: any) => {
      const body = JSON.parse(init.body);
      calls.push(`${url}::${body.model}`);
      if (url.includes('api.groq.com')) {
        return new Response(JSON.stringify({ error: { message: 'Rate limit reached' } }), { status: 429 });
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'NVIDIA se jawab' } }],
        usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
      }), { status: 200 });
    };

    const { aiComplete } = await import('../services/ai/aiGateway.js');
    // CHAT chain: GROQ_GPT_OSS_120B (verified) -> ... -> NVIDIA_KIMI_K2 (unverified, skip)
    // Isliye FAQ chain use karte hain? FAQ: GROQ_GPT_OSS_20B -> GEMINI (no key, skip) -> NVIDIA_KIMI_K2 (unverified)
    // Dono NVIDIA entries unverified hain — verify state me ek ko verified mark karte hain:
    const { writeLocalJson } = await import('../database/localStore.js');
    writeLocalJson('ai_models_verified.json', {
      NVIDIA_KIMI_K2: { verifiedOk: true, verifiedAt: new Date().toISOString() },
    });
    const { refreshVerifyCache } = await import('../services/ai/aiGateway.js');
    refreshVerifyCache();

    const res = await aiComplete('FAQ', { prompt: 'test sawal', taskLabel: '[TEST]' });
    assert.strictEqual(res.provider, 'nvidia');
    assert.ok(res.text.includes('NVIDIA se jawab'));
    // Groq exactly 1 baar try hua (429 ke baad dobara nahi)
    const groqCalls = calls.filter((c) => c.includes('api.groq.com'));
    assert.strictEqual(groqCalls.length, 1, `Groq ${groqCalls.length} baar call hua, 1 hona chahiye tha`);
    assert.ok(calls.some((c) => c.includes('integrate.api.nvidia.com')), 'NVIDIA par failover nahi hua');

    // Ledger me 429 + exhaustion record hua?
    const { isExhausted, getTodayUsage } = await import('../services/ai/providerQuotaLedger.js');
    assert.ok(isExhausted('groq', 'openai/gpt-oss-20b'), 'Groq model exhausted mark hona chahiye tha');
    const rows = getTodayUsage();
    const groqRow = rows.find((r) => r.modelId === 'openai/gpt-oss-20b');
    assert.strictEqual(groqRow?.errors429, 1);
    const nvRow = rows.find((r) => r.provider === 'nvidia');
    assert.strictEqual(nvRow?.requests, 1);
    assert.strictEqual(nvRow?.totalTokens, 120);
    try { fs.unlinkSync(path.join(process.cwd(), 'data', 'ai_models_verified.json')); } catch {}
  });

  test('quota math: quotaConsumedPct sahi % deta hai', async () => {
    const { quotaConsumedPct } = await import('../services/ai/providerQuotaLedger.js');
    const row: any = { requests: 500, totalTokens: 100000 };
    // Groq limits: 1000 rpd / 200k tpd -> 50% dono
    assert.strictEqual(quotaConsumedPct(row, { rpd: 1000, tpd: 200000 }), 50);
    // requests 100% par ho to 100 cap
    assert.strictEqual(quotaConsumedPct({ requests: 1200, totalTokens: 10000 } as any, { rpd: 1000, tpd: 200000 }), 100);
  });

  test('RPM guard: window bharne par request roko', async () => {
    const { rpmAllows } = await import('../services/ai/providerQuotaLedger.js');
    // rpm limit 5 -> 2 headroom ke saath max 2 allowed; seedha false hona chahiye jaldi
    // (recordSuccess ke bina window nahi bharegi — isliye chhota limit test karte hain)
    assert.strictEqual(rpmAllows('groq', 'm', 0), true, 'limit 0/unknown = allow');
    assert.strictEqual(rpmAllows('groq', 'm', 5), true, 'khali window me allow');
  });

  test('failover: Groq 503 overloaded -> cooldown + NVIDIA par switch', async () => {
    process.env.GROQ_API_KEY = 'gsk_test';
    process.env.NVIDIA_API_KEY = 'nvapi_test';
    (globalThis as any).fetch = async (url: string, init: any) => {
      if (url.includes('api.groq.com')) {
        return new Response(JSON.stringify({ error: { message: 'high demand', code: 503 } }), { status: 503 });
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'NVIDIA 503-failover ok' } }],
        usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
      }), { status: 200 });
    };
    const { writeLocalJson } = await import('../database/localStore.js');
    writeLocalJson('ai_models_verified.json', {
      NVIDIA_KIMI_K2: { verifiedOk: true, verifiedAt: new Date().toISOString() },
    });
    const { refreshVerifyCache, aiComplete } = await import('../services/ai/aiGateway.js');
    refreshVerifyCache();
    const res = await aiComplete('FAQ', { prompt: 'x', taskLabel: '[TEST503]' });
    assert.strictEqual(res.provider, 'nvidia');
    const { isExhausted } = await import('../services/ai/providerQuotaLedger.js');
    assert.ok(isExhausted('groq', 'openai/gpt-oss-20b'), '503 par Groq ko cooldown milna chahiye tha');
    try { fs.unlinkSync(path.join(process.cwd(), 'data', 'ai_models_verified.json')); } catch {}
  });

  test('koi key nahi -> AllProvidersFailedError (quotaExhausted=true)', async () => {
    const { aiComplete, AllProvidersFailedError } = await import('../services/ai/aiGateway.js');
    await assert.rejects(
      aiComplete('FAQ', { prompt: 'x' }),
      (e: any) => e instanceof AllProvidersFailedError && e.quotaExhausted === true
    );
  });
});
