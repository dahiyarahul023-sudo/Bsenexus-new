/**
 * MODEL REGISTRY — Bsenexus AI Gateway ka single source of truth.
 *
 * RULE: poora codebase sirf `ModelAlias` (stable internal naam) use karega.
 * Raw provider model IDs SIRF is file me likhe jayenge — kahin aur ek bhi
 * hardcoded model string nahi hoga. Galat spelling ka risk isi ek file tak
 * simat jata hai, aur ye file `verifyModels.ts` se live catalog ke against
 * verify hoti hai (deploy se pehle + nightly + admin trigger).
 *
 * `verifiedOk: false` wale entries gateway me SKIP hote hain jab tak verify
 * script unhe confirm na kar de. Isliye naya/uncertain model ID kabhi
 * production call me nahi jayega.
 */

export type ProviderId = 'gemini' | 'groq' | 'nvidia';
export type AiTask = 'SUMMARY' | 'FAQ' | 'CHAT' | 'SEO';

export interface ModelLimits {
  rpm: number; // requests per minute (provider-published; -1 = unknown)
  rpd: number; // requests per day (-1 = unknown)
  tpm: number; // tokens per minute (-1 = unknown)
  tpd: number; // tokens per day (-1 = unknown)
}

export interface ModelEntry {
  /** Stable internal alias — code me SIRF ye use hoga. */
  alias: string;
  provider: ProviderId;
  /** Exact API model id. Sirf yahan likha jata hai. */
  modelId: string;
  /** verifyModels.ts ne live catalog me confirm kiya? false = gateway skip karega. */
  verifiedOk: boolean;
  verifiedAt?: string;
  verifyNote?: string;
  limits: ModelLimits;
  /** Is model ko kis liye chuna gaya. */
  role: string;
}

const INF = Number.MAX_SAFE_INTEGER;

export const MODEL_REGISTRY: ModelEntry[] = [
  // ---------------- GEMINI (already working in production) ----------------
  {
    alias: 'GEMINI_FLASH_LITE',
    provider: 'gemini',
    modelId: 'gemini-3.1-flash-lite',
    verifiedOk: true,
    verifiedAt: '2026-10-05',
    verifyNote: 'Production me chal raha hai (Oct 2026).',
    limits: { rpm: 30, rpd: 1500, tpm: INF, tpd: INF },
    role: 'Primary: filing summaries, FAQ, SEO — sabse sasta/tezz Gemini free model',
  },
  {
    alias: 'GEMINI_FLASH_LATEST',
    provider: 'gemini',
    modelId: 'gemini-flash-latest',
    verifiedOk: true,
    verifiedAt: '2026-10-05',
    verifyNote: 'Production me chal raha hai (Oct 2026).',
    limits: { rpm: 30, rpd: 1500, tpm: INF, tpd: INF },
    role: 'Fallback: Gemini chain ka dusra model',
  },

  // ---------------- GROQ (https://api.groq.com/openai/v1) ----------------
  // Free tier Oct 2026: 30 RPM; gpt-oss class per-model 1,000 RPD / 8K TPM / 200K TPD.
  // NOTE: Groq ka free roster 2026 me simta hai — ye IDs Sep 2026 probes me
  // live mile the; verify script har deploy par re-confirm karega.
  {
    alias: 'GROQ_GPT_OSS_120B',
    provider: 'groq',
    modelId: 'openai/gpt-oss-120b',
    verifiedOk: true,
    verifiedAt: '2026-10-05',
    verifyNote: 'Sep 2026 third-party probes me live confirm hua; verify script re-check karega.',
    limits: { rpm: 30, rpd: 1000, tpm: 8000, tpd: 200000 },
    role: 'Primary: CHAT (user Q&A) — bada model, behtar jawab; SUMMARY fallback',
  },
  {
    alias: 'GROQ_GPT_OSS_20B',
    provider: 'groq',
    modelId: 'openai/gpt-oss-20b',
    verifiedOk: true,
    verifiedAt: '2026-10-05',
    verifyNote: 'Sep 2026 probes me live confirm hua; verify script re-check karega.',
    limits: { rpm: 30, rpd: 1000, tpm: 8000, tpd: 200000 },
    role: 'Primary: FAQ — chhota/tezz model, chhote jawabon ke liye',
  },
  {
    alias: 'GROQ_QWEN_27B',
    provider: 'groq',
    modelId: 'qwen/qwen3.8-27b',
    verifiedOk: false,
    verifyNote: 'ID uncertain hai (kuch sources me qwen3.6-27b). Verify script live catalog se pakka karega tabhi use hoga.',
    limits: { rpm: 30, rpd: 1000, tpm: 8000, tpd: 200000 },
    role: 'Extra bench: Groq ka teesra option (verify ke baad hi)',
  },

  // ---------------- NVIDIA (https://integrate.api.nvidia.com/v1) ----------------
  // Free tier: ~40 RPM / 10,000 RPD (vendor published). Rate limit PER-MODEL hai
  // (per-key nahi) — isliye 429 par model switch karna hi sahi strategy hai.
  // IDs bina notice rename hote hain — sab verifiedOk:false se start, sirf
  // verify script ke confirm karne par live honge.
  {
    alias: 'NVIDIA_LLAMA_MAVERICK',
    provider: 'nvidia',
    modelId: 'meta/llama-4-maverick-17b-128e-instruct',
    verifiedOk: false,
    verifyNote: 'Sep 2026 me free endpoint tha; roster rotate hota hai — verify ke baad hi use.',
    limits: { rpm: 35, rpd: 10000, tpm: INF, tpd: INF },
    role: 'Deep bench: SUMMARY/SEO fallback (bada context, instruct model)',
  },
  {
    alias: 'NVIDIA_KIMI_K2',
    provider: 'nvidia',
    modelId: 'moonshotai/kimi-k2.6',
    verifiedOk: false,
    verifyNote: 'Sep 2026 me free endpoint tha; verify ke baad hi use.',
    limits: { rpm: 35, rpd: 10000, tpm: INF, tpd: INF },
    role: 'Deep bench: CHAT/FAQ fallback',
  },
  {
    alias: 'NVIDIA_MISTRAL_LARGE',
    provider: 'nvidia',
    modelId: 'mistralai/mistral-large-3-675b-instruct-2512',
    verifiedOk: false,
    verifyNote: 'Sep 2026 me free endpoint tha; verify ke baad hi use.',
    limits: { rpm: 35, rpd: 10000, tpm: INF, tpd: INF },
    role: 'Deep bench: aakhri fallback (bada model, slow ho sakta hai)',
  },
];

/**
 * Har AI task ki failover chain — pehle se aakhri tak.
 * Gateway isi order me try karta hai; jo model exhausted/unverified/key-missing
 * ho use skip kar deta hai. "Ek hi model me atke rehna" impossible hai.
 *
 * NOTE (privacy): NVIDIA apne terms me kehta hai input/output training ke liye
 * record ho sakta hai — isliye CHAT (user ke sawal) me NVIDIA sabse last hai.
 */
export const TASK_CHAINS: Record<AiTask, string[]> = {
  SUMMARY: ['GEMINI_FLASH_LITE', 'GEMINI_FLASH_LATEST', 'GROQ_GPT_OSS_120B', 'NVIDIA_LLAMA_MAVERICK', 'NVIDIA_KIMI_K2'],
  FAQ: ['GROQ_GPT_OSS_20B', 'GEMINI_FLASH_LITE', 'NVIDIA_KIMI_K2'],
  CHAT: ['GROQ_GPT_OSS_120B', 'GEMINI_FLASH_LITE', 'GEMINI_FLASH_LATEST', 'NVIDIA_KIMI_K2', 'NVIDIA_MISTRAL_LARGE'],
  SEO: ['GEMINI_FLASH_LITE', 'GROQ_GPT_OSS_120B', 'NVIDIA_LLAMA_MAVERICK'],
};

export const PROVIDER_BASE_URL: Record<'groq' | 'nvidia', string> = {
  groq: 'https://api.groq.com/openai/v1',
  nvidia: 'https://integrate.api.nvidia.com/v1',
};

export const PROVIDER_ENV_KEY: Record<ProviderId, string> = {
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  nvidia: 'NVIDIA_API_KEY',
};

/** 429 aane par kitni der us model ko chain se bahar rakhen (ms). */
export const PROVIDER_COOLDOWN_MS: Record<ProviderId, number> = {
  gemini: 30_000, // 30s — existing circuit breaker bhi hai
  groq: 10 * 60_000, // 10 min
  nvidia: 15 * 60_000, // 15 min (NVIDIA 429 ke baad >12 min tak throttled rehta hai, aur Retry-After header nahi deta)
};

export function getModelEntry(alias: string): ModelEntry | undefined {
  return MODEL_REGISTRY.find((m) => m.alias === alias);
}

export function providerKeyPresent(provider: ProviderId): boolean {
  const v = process.env[PROVIDER_ENV_KEY[provider]];
  return Boolean(v && v.trim().length > 0);
}

/** Kam se kam ek provider ki key maujood hai? */
export function hasAnyAiProvider(): boolean {
  return (['gemini', 'groq', 'nvidia'] as ProviderId[]).some(providerKeyPresent);
}
