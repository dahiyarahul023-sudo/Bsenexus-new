import React from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAiQuota } from '../utils/aiQuota';

export function AiUsageCard() {
  const {user,profile,isPro,isAdmin}=useAuth();
  const quota=useAiQuota(user,profile,isPro,isAdmin);
  const verified=quota.source === 'server';
  return (
    <section aria-label="AI summary usage" className="bg-white dark:bg-[#181626] border border-slate-200 dark:border-[#252236] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><Sparkles size={16} />AI summary usage</h3>
        {quota.source !== 'guest' && <button type="button" aria-label="Refresh AI usage" disabled={quota.source === 'checking'} onClick={() => window.dispatchEvent(new Event('bse_ai_quota_refresh'))} className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-slate-600 dark:text-slate-300 disabled:opacity-50"><RefreshCw size={16} /></button>}
      </div>
      {verified && quota.tier === 'pro' ? (
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-800 dark:text-slate-200">
          <p><strong>{quota.usedToday} / {quota.dailyLimit}</strong> used today</p>
          <p><strong>{quota.remaining}</strong> remaining</p>
        </div>
      ) : <p role={quota.source === 'unavailable' ? 'alert' : 'status'} className="text-sm text-slate-600 dark:text-slate-300">{quota.message}</p>}
      {verified && <p className="text-xs text-slate-500 dark:text-slate-400">{quota.tier === 'pro' ? 'Daily allowance resets at 00:00 IST.' : quota.tier === 'free' ? 'The free demo is one-time; it does not reset daily.' : quota.tier === 'admin' ? 'Admin access has no daily cap.' : 'Sign in to use AI summaries.'}{quota.checkedAt && ` Last checked ${new Date(quota.checkedAt).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'})} IST.`}</p>}
    </section>
  );
}
