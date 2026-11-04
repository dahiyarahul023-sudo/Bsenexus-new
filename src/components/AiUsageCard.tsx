import React, { useState } from 'react';
import { Sparkles, RefreshCw, RotateCcw, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAiQuota } from '../utils/aiQuota';
import { customFetch } from '../api';

export function AiUsageCard() {
  const {user,profile,isPro,isAdmin}=useAuth();
  const quota=useAiQuota(user,profile,isPro,isAdmin);
  const verified=quota.source === 'server';
  const [isResetting, setIsResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);

  const handleAdminResetAll = async () => {
    if (!isAdmin) return;
    setIsResetting(true);
    setResetFeedback(null);
    try {
      const res = await customFetch('/api/billing/reset-quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'all' })
      });
      const data = await res.json();
      if (data.success) {
        setResetFeedback(data.message || 'All users daily AI quotas reset successfully.');
        window.dispatchEvent(new Event('bse_ai_quota_refresh'));
      } else {
        setResetFeedback(data.error || 'Failed to reset quotas.');
      }
    } catch (e: any) {
      setResetFeedback(e?.message || 'Error communicating with server.');
    } finally {
      setIsResetting(false);
      setTimeout(() => setResetFeedback(null), 5000);
    }
  };

  return (
    <section aria-label="AI summary usage" className="bg-white dark:bg-[#181626] border border-slate-200 dark:border-[#252236] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Sparkles size={16} className="text-purple-500" />
          AI summary usage
        </h3>
        <div className="flex items-center gap-1.5">
          {quota.source !== 'guest' && (
            <button 
              type="button" 
              aria-label="Refresh AI usage" 
              disabled={quota.source === 'checking'} 
              onClick={() => window.dispatchEvent(new Event('bse_ai_quota_refresh'))} 
              className="flex items-center justify-center min-h-[36px] min-w-[36px] rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#201E2E] disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={15} />
            </button>
          )}
        </div>
      </div>

      {verified && (quota.tier === 'admin' || isAdmin) ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2 p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-purple-600 dark:text-purple-400" />
              <div>
                <p className="text-xs font-bold text-purple-950 dark:text-purple-200">Admin Unlimited Access</p>
                <p className="text-[11px] text-purple-700 dark:text-purple-300">No daily cap or usage restrictions</p>
              </div>
            </div>
            <button
              type="button"
              disabled={isResetting}
              onClick={handleAdminResetAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-all cursor-pointer"
            >
              <RotateCcw size={12} className={isResetting ? "animate-spin" : ""} />
              <span>{isResetting ? 'Resetting...' : 'Reset All Daily Quotas'}</span>
            </button>
          </div>
          {resetFeedback && (
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>{resetFeedback}</span>
            </div>
          )}
        </div>
      ) : verified && quota.tier === 'pro' ? (
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-800 dark:text-slate-200">
          <p><strong>{quota.usedToday} / {quota.dailyLimit}</strong> used today</p>
          <p><strong>{quota.remaining}</strong> remaining</p>
        </div>
      ) : (
        <p role={quota.source === 'unavailable' ? 'alert' : 'status'} className="text-sm text-slate-600 dark:text-slate-300">{quota.message}</p>
      )}

      {verified && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {quota.tier === 'admin' || isAdmin
            ? 'Administrator accounts have unlimited Gemini AI synthesis with zero daily limits.'
            : quota.tier === 'pro'
            ? 'Daily allowance resets at 00:00 IST.'
            : quota.tier === 'free'
            ? 'The free demo is one-time; it does not reset daily.'
            : 'Sign in to use AI summaries.'}
          {quota.checkedAt && ` Last checked ${new Date(quota.checkedAt).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'})} IST.`}
        </p>
      )}
    </section>
  );
}
