/**
 * PROVIDER QUOTA LEDGER — har provider+model ne aaj kitna kharch kiya.
 *
 * - Per-day buckets (UTC date; Groq ka reset ~midnight UTC hota hai).
 * - Har successful call par requests + tokens record hote hain.
 * - 429 aane par model `exhaustedUntil` tak chain se bahar (failover me skip).
 * - RPM sliding-window guard: burst karke 429 khaane se pehle hi request
 *   agle model par bhej di jati hai.
 * - Storage: local JSON (existing ai_usage.json jaisa pattern). Admin
 *   endpoint /api/admin/ai-usage isi se dashboard banata hai.
 */
import { readLocalJson, writeLocalJson } from '../../database/localStore.js';
import { PROVIDER_COOLDOWN_MS, type ProviderId } from './modelRegistry.js';

const LEDGER_FILE = 'ai_provider_usage.json';

export interface ModelDayStats {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  errors429: number;
  errorsOther: number;
  /** Epoch ms — is time tak model exhausted mana jayega (0 = ok). */
  exhaustedUntil: number;
  lastError: string;
  lastSuccessAt: number;
}

function emptyStats(): ModelDayStats {
  return {
    requests: 0, promptTokens: 0, completionTokens: 0,
    errors429: 0, errorsOther: 0, exhaustedUntil: 0,
    lastError: '', lastSuccessAt: 0,
  };
}

function todayKeyUTC(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function ledgerKey(provider: ProviderId, modelId: string, day = todayKeyUTC()): string {
  return `${provider}:${modelId}:${day}`;
}

function readLedger(): Record<string, ModelDayStats> {
  return readLocalJson<Record<string, ModelDayStats>>(LEDGER_FILE, {});
}

// ---- In-memory RPM sliding window (process-local) ----
const rpmWindows = new Map<string, number[]>();

function rpmWindowKey(provider: ProviderId, modelId: string): string {
  return `${provider}:${modelId}`;
}

function pruneWindow(key: string): number[] {
  const now = Date.now();
  const arr = (rpmWindows.get(key) || []).filter((t) => now - t < 60_000);
  rpmWindows.set(key, arr);
  return arr;
}

/** Kya is model par abhi ek aur request bheji ja sakti hai (RPM guard)? */
export function rpmAllows(provider: ProviderId, modelId: string, rpmLimit: number): boolean {
  if (rpmLimit <= 0) return true;
  const arr = pruneWindow(rpmWindowKey(provider, modelId));
  // 3 req ka headroom rakhte hain taaki limit ke bilkul kinare na jayen
  return arr.length < Math.max(1, rpmLimit - 3);
}

function rpmRecord(provider: ProviderId, modelId: string): void {
  const key = rpmWindowKey(provider, modelId);
  const arr = pruneWindow(key);
  arr.push(Date.now());
  rpmWindows.set(key, arr);
}

/** Kya model abhi exhausted hai (429 cooldown chal raha hai)? */
export function isExhausted(provider: ProviderId, modelId: string): boolean {
  const stats = readLedger()[ledgerKey(provider, modelId)];
  return Boolean(stats && stats.exhaustedUntil > Date.now());
}

export function recordSuccess(
  provider: ProviderId,
  modelId: string,
  usage: { promptTokens: number; completionTokens: number }
): void {
  try {
    const ledger = readLedger();
    const key = ledgerKey(provider, modelId);
    const s = ledger[key] || emptyStats();
    s.requests += 1;
    s.promptTokens += usage.promptTokens || 0;
    s.completionTokens += usage.completionTokens || 0;
    s.lastSuccessAt = Date.now();
    // Success ne cooldown clear kar diya (agar koi purana laga tha)
    if (s.exhaustedUntil && s.exhaustedUntil < Date.now()) s.exhaustedUntil = 0;
    ledger[key] = s;
    writeLocalJson(LEDGER_FILE, ledger);
    rpmRecord(provider, modelId);
  } catch { /* ledger failure kabhi AI call nahi rokega */ }
}

export function recordRateLimit(provider: ProviderId, modelId: string, retryAfterMs?: number): void {
  try {
    const ledger = readLedger();
    const key = ledgerKey(provider, modelId);
    const s = ledger[key] || emptyStats();
    s.errors429 += 1;
    const cooldown = retryAfterMs && retryAfterMs > 0
      ? retryAfterMs
      : PROVIDER_COOLDOWN_MS[provider];
    s.exhaustedUntil = Date.now() + cooldown;
    s.lastError = `429 rate limit @ ${new Date().toISOString()} (cooldown ${Math.round(cooldown / 60000)}m)`;
    ledger[key] = s;
    writeLocalJson(LEDGER_FILE, ledger);
  } catch { /* best-effort */ }
}

export function recordOtherError(provider: ProviderId, modelId: string, errMsg: string): void {
  try {
    const ledger = readLedger();
    const key = ledgerKey(provider, modelId);
    const s = ledger[key] || emptyStats();
    s.errorsOther += 1;
    s.lastError = `${new Date().toISOString()}: ${String(errMsg).slice(0, 160)}`;
    ledger[key] = s;
    writeLocalJson(LEDGER_FILE, ledger);
  } catch { /* best-effort */ }
}

/** Model ko verify-fail par manually unverified mark karna ho to (gateway use karta hai). */
export function clearExhaustion(provider: ProviderId, modelId: string): void {
  try {
    const ledger = readLedger();
    const key = ledgerKey(provider, modelId);
    const s = ledger[key];
    if (s) {
      s.exhaustedUntil = 0;
      ledger[key] = s;
      writeLocalJson(LEDGER_FILE, ledger);
    }
  } catch { /* best-effort */ }
}

export interface ProviderUsageRow {
  provider: ProviderId;
  modelId: string;
  day: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  errors429: number;
  errorsOther: number;
  exhausted: boolean;
  exhaustedUntil: number;
  lastError: string;
  lastSuccessAt: number;
}

/** Admin dashboard ke liye: aaj (UTC) ka poora hisaab. */
export function getTodayUsage(): ProviderUsageRow[] {
  const day = todayKeyUTC();
  const ledger = readLedger();
  const rows: ProviderUsageRow[] = [];
  for (const [key, s] of Object.entries(ledger)) {
    if (!key.endsWith(`:${day}`)) continue;
    const [provider, ...rest] = key.split(':');
    const modelId = rest.slice(0, -1).join(':');
    rows.push({
      provider: provider as ProviderId,
      modelId,
      day,
      requests: s.requests,
      promptTokens: s.promptTokens,
      completionTokens: s.completionTokens,
      totalTokens: s.promptTokens + s.completionTokens,
      errors429: s.errors429,
      errorsOther: s.errorsOther,
      exhausted: s.exhaustedUntil > Date.now(),
      exhaustedUntil: s.exhaustedUntil,
      lastError: s.lastError,
      lastSuccessAt: s.lastSuccessAt,
    });
  }
  rows.sort((a, b) => b.totalTokens - a.totalTokens);
  return rows;
}

/**
 * Quota consumption % — registry limits ke against.
 * tpd/rpd me se jo pehle bharega wahi dikhega. -1 (unknown) wale ignore.
 */
export function quotaConsumedPct(
  row: ProviderUsageRow,
  limits: { rpd: number; tpd: number }
): number {
  const parts: number[] = [];
  if (limits.rpd > 0) parts.push((row.requests / limits.rpd) * 100);
  if (limits.tpd > 0) parts.push((row.totalTokens / limits.tpd) * 100);
  if (parts.length === 0) return 0;
  return Math.min(100, Math.max(...parts));
}
