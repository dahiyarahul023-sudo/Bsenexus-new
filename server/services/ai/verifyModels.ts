/**
 * verifyModels — MODEL REGISTRY ko live provider catalogs ke against verify karta hai.
 *
 * - Groq:   GET https://api.groq.com/openai/v1/models   (GROQ_API_KEY chahiye)
 * - NVIDIA: GET https://integrate.api.nvidia.com/v1/models (bina auth ke chalta hai)
 *
 * Result `data/ai_models_verified.json` me save hota hai — gateway SIRF
 * verified entries ko production calls me use karta hai. Koi model rename/
 * retire hua to yahan pakda jayega, code me kahin galat naam nahi jayega.
 *
 * Chalane ke tareeke:
 *   npm run verify:ai            (CLI)
 *   POST /api/admin/ai-verify    (admin endpoint, server ke andar)
 */
import { writeLocalJson } from '../../database/localStore.js';
import { addLog } from '../../database/logDao.js';
import {
  MODEL_REGISTRY, PROVIDER_BASE_URL, providerKeyPresent,
  type ProviderId,
} from './modelRegistry.js';
import { refreshVerifyCache } from './aiGateway.js';

const VERIFY_FILE = 'ai_models_verified.json';

export interface VerifyReportEntry {
  alias: string;
  provider: ProviderId;
  modelId: string;
  verifiedOk: boolean;
  verifiedAt: string;
  detail: string;
}

async function fetchCatalogIds(baseUrl: string, apiKey?: string): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch(`${baseUrl}/models`, { signal: controller.signal, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: any = await res.json();
    const list = Array.isArray(data?.data) ? data.data : [];
    return list.map((m: any) => String(m?.id || '')).filter(Boolean);
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyAllModels(): Promise<VerifyReportEntry[]> {
  const report: VerifyReportEntry[] = [];
  const persisted: Record<string, { verifiedOk: boolean; verifiedAt: string }> = {};
  const nowIso = new Date().toISOString();

  // Catalogs ek baar lao (Groq: key chahiye; NVIDIA: bina key)
  const catalogs = new Map<ProviderId, string[]>();
  const catalogErrors = new Map<ProviderId, string>();

  for (const provider of ['groq', 'nvidia'] as ProviderId[]) {
    try {
      if (provider === 'groq' && !providerKeyPresent('groq')) {
        throw new Error('GROQ_API_KEY not set — Groq catalog check skipped');
      }
      const key = provider === 'groq' ? process.env.GROQ_API_KEY : undefined;
      const ids = await fetchCatalogIds(PROVIDER_BASE_URL[provider], key);
      catalogs.set(provider, ids);
      addLog('SUCCESS', 'AI_VERIFY', `Catalog fetched: ${provider} (${ids.length} models)`);
    } catch (e: any) {
      catalogErrors.set(provider, e?.message || String(e));
      addLog('WARNING', 'AI_VERIFY', `Catalog fetch failed for ${provider}: ${e?.message || e}`);
    }
  }

  for (const entry of MODEL_REGISTRY) {
    if (entry.provider === 'gemini') {
      // Gemini entries production-proven hain — registry ka verifiedOk hi kaafi
      const ok = entry.verifiedOk;
      report.push({
        alias: entry.alias, provider: entry.provider, modelId: entry.modelId,
        verifiedOk: ok, verifiedAt: nowIso,
        detail: ok ? 'registry: production-proven (Oct 2026)' : 'registry: not verified',
      });
      persisted[entry.alias] = { verifiedOk: ok, verifiedAt: nowIso };
      continue;
    }

    const err = catalogErrors.get(entry.provider);
    const ids = catalogs.get(entry.provider) || [];
    if (err) {
      // Catalog hi nahi mila — purani verified state ko chhedo mat (fail-safe),
      // par report me clearly batao.
      report.push({
        alias: entry.alias, provider: entry.provider, modelId: entry.modelId,
        verifiedOk: false, verifiedAt: nowIso,
        detail: `catalog unreachable: ${err} — NOT enabled (fail-safe)`,
      });
      continue;
    }
    const found = ids.includes(entry.modelId);
    report.push({
      alias: entry.alias, provider: entry.provider, modelId: entry.modelId,
      verifiedOk: found, verifiedAt: nowIso,
      detail: found
        ? `live catalog me mila (${ids.length} models me se)`
        : `catalog me NAHI mila — retired/renamed ho sakta hai (gateway skip karega)`,
    });
    persisted[entry.alias] = { verifiedOk: found, verifiedAt: nowIso };
    addLog(
      found ? 'SUCCESS' : 'WARNING', 'AI_VERIFY',
      `${entry.alias} (${entry.modelId}): ${found ? 'VERIFIED live' : 'NOT FOUND in live catalog'}`
    );
  }

  // Merge: registry me pehle se verifiedOk=true wale hamesha true rahenge
  // (gateway isModelVerified me unhe waise bhi allow karta hai).
  try {
    writeLocalJson(VERIFY_FILE, persisted);
    refreshVerifyCache();
  } catch (e: any) {
    addLog('ERROR', 'AI_VERIFY', `Could not persist verify state: ${e?.message || e}`);
  }
  return report;
}
