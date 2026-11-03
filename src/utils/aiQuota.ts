import { PRO_AI_SUMMARIES_PER_DAY } from '../shared/productFacts';
import { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { customFetch } from '../api';

export interface AiQuotaStatus {
  tier: 'guest' | 'free' | 'pro' | 'admin';
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  canGenerate: boolean;
  allowed: boolean;
  message?: string;
  source: 'checking' | 'server' | 'unavailable' | 'guest';
  checkedAt?: number;
}
export interface QuotaConsumeResult {
  allowed: boolean;
  tier: 'guest' | 'free' | 'pro' | 'admin';
  dailyLimit: number;
  remaining: number;
}

/** Responses trigger a fresh authenticated read, never a shared browser quota cache. */
export function updateServerAiQuota(data: {remainingQuota?: number; remaining?: number; dailyLimit?: number; isPro?: boolean}) {
  if (data && (typeof data.remainingQuota === 'number' || typeof data.remaining === 'number')) {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('bse_ai_quota_changed'));
  }
}
export function syncQuotaFromResponse(data: any) { if (data) updateServerAiQuota(data); }

/** Reject malformed responses instead of displaying invented zero/full usage. */
export function parseServerAiQuota(data: any): AiQuotaStatus | null {
  if (!data || !['guest','free','pro','admin'].includes(data.tier) || typeof data.canGenerate !== 'boolean' || !Number.isInteger(data.usedToday) || data.usedToday < 0) return null;
  if (data.tier === 'admin') {
    // JSON serializes the backend's Infinity as null.
    if ((data.dailyLimit !== null && data.dailyLimit !== Infinity) || (data.remaining !== null && data.remaining !== Infinity) || !data.canGenerate) return null;
    return {tier:'admin',dailyLimit:Infinity,usedToday:data.usedToday,remaining:Infinity,canGenerate:true,allowed:true,source:'server',message:'No daily cap (admin)'};
  }
  const expectedLimit = data.tier === 'pro' ? PRO_AI_SUMMARIES_PER_DAY : data.tier === 'free' ? 1 : 0;
  if (data.dailyLimit !== expectedLimit || data.usedToday > expectedLimit || !Number.isInteger(data.remaining) || data.remaining !== expectedLimit-data.usedToday || data.canGenerate !== (data.remaining > 0)) return null;
  return {tier:data.tier,dailyLimit:data.dailyLimit,usedToday:data.usedToday,remaining:data.remaining,canGenerate:data.canGenerate,allowed:data.canGenerate,source:'server',message:data.tier === 'pro' ? `${data.remaining}/${data.dailyLimit} AI summaries remaining today. Resets at 00:00 IST.` : data.tier === 'free' ? `${data.remaining} of 1 one-time AI summary demo remaining.` : 'Sign in to use AI summaries.'};
}
export async function fetchServerAiQuota(signal?: AbortSignal): Promise<AiQuotaStatus | null> {
  const timeout = new AbortController();
  const abort = () => timeout.abort();
  if (signal?.aborted) return null;
  signal?.addEventListener('abort',abort,{once:true});
  const timer = setTimeout(abort,12000);
  try {
    const res = await customFetch('/api/billing/quota',{signal:timeout.signal});
    if (!res.ok) return null;
    const parsed = parseServerAiQuota(await res.json());
    return parsed ? {...parsed,checkedAt:Date.now()} : null;
  } catch {return null;}
  finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

/** Pending UI eligibility is never presented as a verified quota count. */
export function getAiQuotaStatus(user?: any | null, profile?: UserProfile | null, isPro?: boolean, isAdmin?: boolean): AiQuotaStatus {
  const guest = !user || user.isAnonymous || profile?.tier === 'guest';
  const tier = guest ? 'guest' : isAdmin || profile?.tier === 'admin' ? 'admin' : isPro ? 'pro' : 'free';
  return {tier,dailyLimit:tier === 'admin' ? Infinity : tier === 'pro' ? PRO_AI_SUMMARIES_PER_DAY : tier === 'free' ? 1 : 0,usedToday:0,remaining:0,canGenerate:false,allowed:false,source:guest ? 'guest' : 'checking',message:guest ? 'Sign in to see your AI usage.' : 'Checking AI usage...'};
}
/** Legacy preflight wrapper: the server reserves/refunds; the browser never debits quota. */
export function consumeAiQuota(user?: any | null, profile?: UserProfile | null, isPro?: boolean, isAdmin?: boolean): QuotaConsumeResult {
  const q=getAiQuotaStatus(user,profile,isPro,isAdmin);
  return {allowed:q.canGenerate,tier:q.tier,dailyLimit:q.dailyLimit,remaining:q.remaining};
}

/** Account-bound state. Refresh on generation, focus, explicit retry, and the IST day boundary. */
export function useAiQuota(user?: any | null, profile?: UserProfile | null, isPro?: boolean, isAdmin?: boolean): AiQuotaStatus {
  const identity = `${user?.uid || 'guest'}:${Boolean(user?.isAnonymous)}:${Boolean(isPro)}:${Boolean(isAdmin)}:${profile?.tier || ''}`;
  const [snapshot,setSnapshot]=useState(() => ({identity,quota:getAiQuotaStatus(user,profile,isPro,isAdmin)}));
  useEffect(() => {
    const initial=getAiQuotaStatus(user,profile,isPro,isAdmin);
    if (initial.source === 'guest') {setSnapshot({identity,quota:initial});return;}
    let active=true, sequence=0;
    let controller: AbortController | undefined;
    let midnightTimer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      const request=++sequence;
      controller?.abort();controller=new AbortController();
      setSnapshot({identity,quota:initial});
      const result=await fetchServerAiQuota(controller.signal);
      if (!active || request !== sequence) return;
      setSnapshot({identity,quota:result || {...initial,source:'unavailable',message:'AI usage is unavailable. Please retry.'}});
    };
    const atMidnight = () => {
      const now=Date.now(), day=86400000, offset=19800000;
      const next=Math.floor((now+offset)/day)*day+day-offset;
      midnightTimer=setTimeout(() => {void refresh();atMidnight();},next-now+20);
    };
    const onVisible = () => {if (document.visibilityState === 'visible') void refresh();};
    void refresh();atMidnight();
    window.addEventListener('bse_ai_quota_changed',refresh);
    window.addEventListener('bse_ai_quota_refresh',refresh);
    window.addEventListener('focus',onVisible);
    document.addEventListener('visibilitychange',onVisible);
    return () => {
      active=false;sequence++;controller?.abort();clearTimeout(midnightTimer);
      window.removeEventListener('bse_ai_quota_changed',refresh);
      window.removeEventListener('bse_ai_quota_refresh',refresh);
      window.removeEventListener('focus',onVisible);
      document.removeEventListener('visibilitychange',onVisible);
    };
  },[identity]);
  return snapshot.identity === identity ? snapshot.quota : getAiQuotaStatus(user,profile,isPro,isAdmin);
}
