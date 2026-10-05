/**
 * OpenAI-compatible chat completions adapter — Groq aur NVIDIA dono ke liye
 * EK HI code (dono ke endpoints OpenAI shape me baat karte hain).
 * Koi nayi npm dependency nahi — sirf fetch.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AdapterResult {
  text: string;
  usage: TokenUsage;
}

export class RateLimitError extends Error {
  retryAfterMs?: number;
  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}
export class ModelNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = 'ModelNotFoundError'; }
}
export class AuthError extends Error {
  constructor(message: string) { super(message); this.name = 'AuthError'; }
}
export class ProviderError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
  }
}

export interface OpenAICompatOptions {
  baseUrl: string; // e.g. https://api.groq.com/openai/v1
  apiKey: string;
  modelId: string; // exact provider model id (registry se aata hai)
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
  providerLabel?: string; // logs ke liye
}

function parseRetryAfterMs(res: Response): number | undefined {
  const h = res.headers.get('retry-after') || res.headers.get('Retry-After');
  if (h) {
    const secs = parseInt(h, 10);
    if (!Number.isNaN(secs)) return secs * 1000;
  }
  // Groq x-ratelimit-reset-tokens jaisa kuch de to yahan pakad lenge
  return undefined;
}

export async function openaiCompatComplete(opts: OpenAICompatOptions): Promise<AdapterResult> {
  const timeoutMs = opts.timeoutMs ?? 25000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body: any = {
      model: opts.modelId,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.4,
    };
    if (opts.maxTokens) body.max_tokens = opts.maxTokens;
    if (opts.jsonMode) body.response_format = { type: 'json_object' };

    const res = await fetch(`${opts.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      throw new RateLimitError(
        `${opts.providerLabel || 'provider'} rate limit (HTTP 429) on ${opts.modelId}`,
        parseRetryAfterMs(res)
      );
    }
    // 503 overloaded = transient — cooldown do, agle model/provider par jao
    if (res.status === 503) {
      const errText = await res.text().catch(() => '');
      throw new RateLimitError(
        `${opts.providerLabel || 'provider'} overloaded (HTTP 503) on ${opts.modelId}: ${errText.slice(0, 120)}`,
        parseRetryAfterMs(res)
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new AuthError(`${opts.providerLabel || 'provider'} auth failed (HTTP ${res.status}) on ${opts.modelId}`);
    }
    if (res.status === 404) {
      // NVIDIA aksar retired/renamed model par 404 deta hai
      throw new ModelNotFoundError(`${opts.providerLabel || 'provider'} model not found (HTTP 404): ${opts.modelId}`);
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      // Kuch providers body me "model_not_found" bhejte hain
      if (/model_not_found|does not exist|not found/i.test(errText)) {
        throw new ModelNotFoundError(`${opts.providerLabel || 'provider'}: ${opts.modelId} not available (${errText.slice(0, 120)})`);
      }
      throw new ProviderError(
        `${opts.providerLabel || 'provider'} HTTP ${res.status} on ${opts.modelId}: ${errText.slice(0, 200)}`,
        res.status
      );
    }

    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new ProviderError(`${opts.providerLabel || 'provider'} returned empty content for ${opts.modelId}`);
    const u = data?.usage || {};
    return {
      text,
      usage: {
        promptTokens: u.prompt_tokens ?? 0,
        completionTokens: u.completion_tokens ?? 0,
        totalTokens: u.total_tokens ?? (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0),
      },
    };
  } catch (e: any) {
    if (e instanceof RateLimitError || e instanceof ModelNotFoundError || e instanceof AuthError || e instanceof ProviderError) throw e;
    if (e?.name === 'AbortError') throw new ProviderError(`${opts.providerLabel || 'provider'} timeout after ${timeoutMs}ms on ${opts.modelId}`);
    throw new ProviderError(`${opts.providerLabel || 'provider'} network error on ${opts.modelId}: ${e?.message || e}`);
  } finally {
    clearTimeout(timer);
  }
}
