/**
 * Gemini adapter — existing @google/genai SDK ka wrapper.
 * OpenAI-compat adapter jaisa hi output shape deta hai taaki gateway
 * provider-agnostic reh sake.
 */
import { GoogleGenAI } from '@google/genai';
import type { AdapterResult, ChatMessage } from './openaiCompat.js';
import { RateLimitError, ModelNotFoundError, AuthError, ProviderError } from './openaiCompat.js';

let aiClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

export interface GeminiCompleteOptions {
  modelId: string;
  systemPrompt?: string;
  prompt?: string;
  messages?: ChatMessage[]; // system alag se jayega, baki history+question
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  /** Inline PDF (sirf Gemini support karta hai) — {base64, mimeType} */
  pdfInline?: { data: string; mimeType: string };
  timeoutMs?: number;
}

function classifyGeminiError(err: any): Error {
  const msg = err?.message || String(err);
  if (/429|RESOURCE_EXHAUSTED|quota|Quota exceeded/i.test(msg)) {
    return new RateLimitError(`Gemini rate limit/quota: ${msg.slice(0, 160)}`);
  }
  if (/API key|API_KEY_INVALID|401|403/i.test(msg)) {
    return new AuthError(`Gemini auth failed: ${msg.slice(0, 160)}`);
  }
  if (/not found|404/i.test(msg)) {
    return new ModelNotFoundError(`Gemini model not found: ${msg.slice(0, 160)}`);
  }
  return new ProviderError(`Gemini error: ${msg.slice(0, 200)}`);
}

export async function geminiComplete(opts: GeminiCompleteOptions): Promise<AdapterResult> {
  const ai = getClient();
  if (!ai) throw new AuthError('GEMINI_API_KEY not configured');

  const contents: any[] = [];
  if (opts.messages && opts.messages.length > 0) {
    // systemPrompt config me jayega; baki messages contents me
    for (const m of opts.messages) {
      if (m.role === 'system') continue;
      contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
    }
  } else if (opts.prompt) {
    contents.push({ text: opts.prompt });
  }
  if (opts.pdfInline) {
    contents.push({ inlineData: { data: opts.pdfInline.data, mimeType: opts.pdfInline.mimeType } });
  }
  if (contents.length === 0) throw new ProviderError('Gemini: empty prompt');

  const config: any = {
    temperature: opts.temperature ?? 0.4,
  };
  const sys = opts.systemPrompt || opts.messages?.find((m) => m.role === 'system')?.content;
  if (sys) config.systemInstruction = sys;
  if (opts.jsonMode) config.responseMimeType = 'application/json';
  if (opts.maxTokens) config.maxOutputTokens = opts.maxTokens;

  try {
    // Timeout guard — SDK ke paas built-in abort nahi hai, isliye race karte hain
    const timeoutMs = opts.timeoutMs ?? 25000;
    const call = ai.models.generateContent({ model: opts.modelId, contents, config });
    const res: any = await Promise.race([
      call,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Gemini timeout after ${timeoutMs}ms`)), timeoutMs)),
    ]);
    const text = res?.text?.trim();
    if (!text) throw new ProviderError('Gemini returned empty content');
    // Gemini SDK usageMetadata (best-effort; na mile to 0)
    const um = res?.usageMetadata || {};
    const promptTokens = um.promptTokenCount ?? 0;
    const completionTokens = um.candidatesTokenCount ?? 0;
    return {
      text,
      usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
    };
  } catch (e: any) {
    throw classifyGeminiError(e);
  }
}
