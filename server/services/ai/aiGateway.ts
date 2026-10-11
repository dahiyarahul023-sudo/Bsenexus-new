/**
 * AI GATEWAY — Bsenexus ke saare AI calls ka EK HI darwaza.
 *
 * Koi bhi feature (filing summary, user Q&A, FAQ, SEO, Telegram summary)
 * seedha kisi provider SDK ko call NAHI karega — sab `aiComplete(task, ...)`
 * se guzrega. Gateway:
 *  1. Task ki chain (modelRegistry.TASK_CHAINS) uthata hai.
 *  2. Har candidate ko check karta hai: key hai? verified hai? exhausted to nahi?
 *     RPM guard ok hai?
 *  3. Pehle available model par call karta hai; 429/quota par us model ko
 *     cooldown par daal kar TURANT agle par jata hai (same model me dobara nahi).
 *  4. Har call ka usage ledger me record karta hai (kisne kitna chalaya).
 *  5. Sab fail hon par throw karta hai — caller apna existing fallback
 *     (heuristic summary / polite message) chalata hai.
 */
import { addLog } from '../../database/logDao.js';
import {
  MODEL_REGISTRY, TASK_CHAINS, PROVIDER_BASE_URL, PROVIDER_ENV_KEY,
  providerKeyPresent, getModelEntry,
  type AiTask, type ModelEntry, type ProviderId,
} from './modelRegistry.js';
import {
  openaiCompatComplete, type ChatMessage,
  RateLimitError, ModelNotFoundError, AuthError,
} from './providers/openaiCompat.js';
import { geminiComplete } from './providers/geminiAdapter.js';
import {
  recordSuccess, recordRateLimit, recordOtherError,
  isExhausted, rpmAllows,
} from './providerQuotaLedger.js';
import { readLocalJson, writeLocalJson } from '../../database/localStore.js';

export interface AiCompleteOptions {
  systemPrompt?: string;
  /** Simple single prompt (summary/SEO/FAQ ke liye). */
  prompt?: string;
  /** Chat-style messages (Q&A ke liye). systemPrompt alag se bhi de sakte hain. */
  messages?: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** JSON output chahiye (SEO tools) — provider ke json mode me jayega. */
  jsonMode?: boolean;
  /** Inline PDF — SIRF Gemini chain par jayega (Groq/NVIDIA PDF nahi lete). */
  pdfInline?: { data: string; mimeType: string };
  timeoutMs?: number;
  /** Logs me pehchan ke liye, e.g. "[RELIANCE]" */
  taskLabel?: string;
}

export interface AiCompleteResult {
  text: string;
  provider: ProviderId;
  modelAlias: string;
  modelId: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export class AllProvidersFailedError extends Error {
  failures: string[];
  quotaExhausted: boolean;
  constructor(failures: string[], quotaExhausted: boolean) {
    super(`ALL_AI_PROVIDERS_FAILED: ${failures.join(' | ').slice(0, 300)}`);
    this.name = 'AllProvidersFailedError';
    this.failures = failures;
    this.quotaExhausted = quotaExhausted;
  }
}

// ---- Verify-state persistence (verifyModels.ts likhta hai, gateway padhta hai) ----
const VERIFY_FILE = 'ai_models_verified.json';
let verifyCache: Record<string, { verifiedOk: boolean; verifiedAt: string }> | null = null;

function loadVerifyState(): Record<string, { verifiedOk: boolean; verifiedAt: string }> {
  if (verifyCache) return verifyCache;
  try {
    verifyCache = readLocalJson(VERIFY_FILE, {});
  } catch {
    verifyCache = {};
  }
  return verifyCache!;
}

/** Admin/verify script ke baad cache refresh. */
export function refreshVerifyCache(): void {
  verifyCache = null;
  loadVerifyState();
}

/** addLog kabhi failover loop nahi todega — fire-and-forget with catch. */
function safeLog(level: string, module: string, message: string): void {
  try {
    const p = addLog(level as any, module, message);
    if (p && typeof (p as any).catch === 'function') (p as any).catch(() => {});
  } catch { /* logging must never break AI calls */ }
}

/** Verify script ne is alias ko live confirm kiya hai? */
export function isModelVerified(alias: string): boolean {
  const entry = getModelEntry(alias);
  if (!entry) return false;
  // Registry me pehle se verified=true (production-proven) wale hamesha allowed
  if (entry.verifiedOk) return true;
  const state = loadVerifyState()[alias];
  return state?.verifiedOk === true;
}

/** Verify-fail par entry ko turant unverified mark karo (agla deploy/verify tak). */
function markUnverified(alias: string, reason: string): void {
  try {
    const state = loadVerifyState();
    state[alias] = { verifiedOk: false, verifiedAt: new Date().toISOString() };
    writeLocalJson(VERIFY_FILE, state);
    verifyCache = state;
    safeLog('WARNING', 'AI_GATEWAY', `Model ${alias} marked UNVERIFIED: ${reason}`);
  } catch { /* best-effort */ }
}

function buildMessages(opts: AiCompleteOptions): ChatMessage[] {
  if (opts.messages && opts.messages.length > 0) {
    const msgs: ChatMessage[] = [];
    if (opts.systemPrompt) msgs.push({ role: 'system', content: opts.systemPrompt });
    for (const m of opts.messages) {
      if (m.role === 'system' && opts.systemPrompt) continue; // duplicate system se bacho
      msgs.push({ role: m.role, content: m.content });
    }
    return msgs;
  }
  return [{ role: 'user', content: opts.prompt || '' }];
}

export async function aiComplete(task: AiTask, opts: AiCompleteOptions): Promise<AiCompleteResult> {
  const label = opts.taskLabel || task;
  const chain = TASK_CHAINS[task] || [];
  const timeoutMs = opts.timeoutMs ?? 25000;

  // PDF sirf Gemini le sakta hai — chain ko usi tak seemit karo
  const pdfOnly = Boolean(opts.pdfInline);
  const candidates: ModelEntry[] = [];
  const skipped: string[] = [];
  for (const alias of chain) {
    const entry = getModelEntry(alias);
    if (!entry) { skipped.push(`${alias}: unknown alias`); continue; }
    if (pdfOnly && entry.provider !== 'gemini') { skipped.push(`${alias}: pdf-only`); continue; }
    if (!providerKeyPresent(entry.provider)) { skipped.push(`${alias}: no ${PROVIDER_ENV_KEY[entry.provider]}`); continue; }
    if (!isModelVerified(alias)) {
      skipped.push(`${alias}: unverified model id`);
      continue;
    }
    if (isExhausted(entry.provider, entry.modelId)) { skipped.push(`${alias}: exhausted(cooldown)`); continue; }
    if (!rpmAllows(entry.provider, entry.modelId, entry.limits.rpm)) {
      skipped.push(`${alias}: rpm-guard`);
      continue;
    }
    candidates.push(entry);
  }
  // Diagnosis ke liye: kaunse candidates kyun skip hue — agli baar turant pata chalega
  // (jaise: keys server env me nahi hain to yahan "no GROQ_API_KEY" dikhega).
  if (skipped.length > 0) {
    safeLog('INFO', 'AI_GATEWAY', `${label} chain [${chain.join(',')}] — tried ${candidates.length}, skipped: ${skipped.join('; ')}`);
  }

  if (candidates.length === 0) {
    throw new AllProvidersFailedError(
      ['no verified+available model in chain (keys missing? all exhausted? models unverified?)'],
      true
    );
  }

  const failures: string[] = [];
  let sawQuotaError = false;

  for (const entry of candidates) {
    const tag = `${entry.provider}/${entry.modelId}`;
    try {
      let res;
      if (entry.provider === 'gemini') {
        res = await geminiComplete({
          modelId: entry.modelId,
          systemPrompt: opts.systemPrompt,
          prompt: opts.prompt,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.4,
          maxTokens: opts.maxTokens,
          jsonMode: opts.jsonMode,
          pdfInline: opts.pdfInline,
          timeoutMs,
        });
      } else {
        const apiKey = process.env[PROVIDER_ENV_KEY[entry.provider]] || '';
        res = await openaiCompatComplete({
          baseUrl: PROVIDER_BASE_URL[entry.provider],
          apiKey,
          modelId: entry.modelId,
          messages: buildMessages(opts),
          temperature: opts.temperature ?? 0.4,
          maxTokens: opts.maxTokens,
          jsonMode: opts.jsonMode,
          timeoutMs,
          providerLabel: entry.provider,
        });
      }

      recordSuccess(entry.provider, entry.modelId, res.usage);
      safeLog(
        'SUCCESS', 'AI_GATEWAY',
        `${label} answered via ${tag} (${res.usage.totalTokens} tokens, ${res.text.length} chars)`
      );
      return {
        text: res.text,
        provider: entry.provider,
        modelAlias: entry.alias,
        modelId: entry.modelId,
        usage: res.usage,
      };
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (e instanceof RateLimitError) {
        sawQuotaError = true;
        recordRateLimit(entry.provider, entry.modelId, e.retryAfterMs);
        safeLog('WARNING', 'AI_GATEWAY', `${label} rate-limited/overloaded on ${tag} — cooling down, trying next.`);
        failures.push(`${tag}: rate-limited`);
        continue; // agle model par — same par dobara NAHI
      }
      if (e instanceof ModelNotFoundError) {
        recordOtherError(entry.provider, entry.modelId, msg);
        markUnverified(entry.alias, msg.slice(0, 120));
        safeLog('ERROR', 'AI_GATEWAY', `${label} model gone on ${tag} — marked unverified, trying next.`);
        failures.push(`${tag}: model-not-found`);
        continue;
      }
      if (e instanceof AuthError) {
        recordOtherError(entry.provider, entry.modelId, msg);
        safeLog('ERROR', 'AI_GATEWAY', `${label} auth failed on ${tag} — check ${PROVIDER_ENV_KEY[entry.provider]}.`);
        failures.push(`${tag}: auth`);
        continue; // same provider ka dusra model bhi fail hoga, par chain me rehne do
      }
      recordOtherError(entry.provider, entry.modelId, msg);
      safeLog('WARNING', 'AI_GATEWAY', `${label} error on ${tag}: ${msg.slice(0, 120)} — trying next.`);
      failures.push(`${tag}: ${msg.slice(0, 80)}`);
    }
  }

  throw new AllProvidersFailedError(failures, sawQuotaError);
}
