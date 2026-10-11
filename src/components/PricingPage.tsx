import React, { useState, useEffect } from 'react';
import { PRO_PLAN_LIST, getLowestPlanPrice, getPlanDisplay } from '../config/plans';
import { PlanCard } from './ui/PlanCard';
import { Sparkles, Tag } from 'lucide-react';
import { customFetch } from '../api';
import { useAuth } from '../context/AuthContext';

export function PricingPage({ onChoosePlan }: { onChoosePlan: (planId: string) => void }) {
  const {user}=useAuth();
  const monthlyPlan = getPlanDisplay('pro_monthly');
  const [referralCode, setReferralCode] = useState('');
  const [isReferralActive, setIsReferralActive] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const ref = urlParams.get('ref') || localStorage.getItem('bse_referral_code') || '';
      if (ref) {
        setReferralCode(ref.toUpperCase());
        setInputCode(ref.toUpperCase());
        setIsReferralActive(false);
        setMessage('Saved code found. Apply it to verify the discount.');
        setShowInput(true);
      }
    }
  }, [monthlyPlan]);

  const handleApply = async (codeToTry: string) => {
    const clean = codeToTry.trim().toUpperCase();
    if (!clean) return;
    try {
      const signedIn=Boolean(user&&!user.isAnonymous);
      const res = signedIn ? await customFetch('/api/referrals/apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:clean})}) : await customFetch(`/api/referrals/validate?code=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (res.ok && data?.success) {
        setReferralCode(clean);
        setIsReferralActive(true);
        setMessage(`Referral code ${clean} applied! Flat ₹${monthlyPlan.referralDiscount} OFF on Monthly (₹${monthlyPlan.referralPrice} instead of ₹${monthlyPlan.price}).`);
        localStorage.setItem('bse_referral_code', clean);
        setShowInput(false);
      } else {
        setMessage('Invalid or inactive referral code.');
      }
    } catch {
      setMessage('Could not validate code.');
    }
  };

  const handleRemove = async () => {
    if(user&&!user.isAnonymous){try{const res=await customFetch('/api/referrals/apply',{method:'DELETE'});if(!res.ok)throw new Error();}catch{setMessage('Could not remove the applied code. Please retry.');return;}}
    setIsReferralActive(false);
    setReferralCode('');
    setMessage(null);
    localStorage.removeItem('bse_referral_code');
  };

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-[#0F0E15] text-slate-900 dark:text-white">
      <main className="max-w-6xl mx-auto px-4 py-10 sm:py-16">
        <a href="/" className="inline-flex min-h-11 items-center text-sm underline">Back to Bsenexus</a>
        
        <div className="mt-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-5xl font-bold">
              Pro plans from ₹{getLowestPlanPrice(isReferralActive)}
            </h1>
            <p className="mt-4 max-w-2xl text-slate-500">
              Free public filings remain available. Pro plans are one-time purchases for the listed duration. Access begins after the server verifies payment.
            </p>
          </div>

          {/* Referral Banner & Toggle */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm max-w-md w-full">
            {isReferralActive ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                  <Sparkles size={16} />
                  <span>Code <strong>{referralCode}</strong> active (Flat ₹100 OFF)</span>
                </div>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
                    <Tag size={13} /> Got a referral code?
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowInput(!showInput)}
                    className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold underline"
                  >
                    {showInput ? 'Close' : 'Apply referral code'}
                  </button>
                </div>
                {showInput && (
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleApply(inputCode); }}
                    className="flex gap-2 mt-2"
                  >
                    <input
                      type="text"
                      placeholder="e.g. CREATOR100"
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent text-inherit"
                    />
                    <button
                      type="submit"
                      className="rich-action rich-action-primary px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      Apply
                    </button>
                  </form>
                )}
              </div>
            )}
            {message && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">{message}</p>}
          </div>
        </div>

        <div className="grid gap-4 mt-8 sm:grid-cols-2 lg:grid-cols-4">
          {PRO_PLAN_LIST.map((plan) => {
            const displayPrice = isReferralActive ? plan.referralPrice : plan.price;
            const wasPrice = isReferralActive ? plan.price : (plan.wasPrice || undefined);
            const sub = isReferralActive
              ? (plan.id === 'pro_monthly' ? 'Flat ₹100 OFF with referral' : `Save ₹${plan.referralDiscount} with referral`)
              : plan.sub;
            return (
              <PlanCard
                key={plan.id}
                title={plan.label}
                price={String(displayPrice)}
                wasPrice={wasPrice ? String(wasPrice) : undefined}
                priceSuffix={`${plan.days} days`}
                sub={sub}
                tag={isReferralActive ? (plan.id === 'pro_monthly' ? '₹100 Referral OFF' : 'Referral Discount') : plan.tag}
                ctaLabel={`Choose ${plan.label}`}
                onCta={() => onChoosePlan(plan.id)}
              />
            );
          })}
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Sign in before checkout. Renewals extend verified access; plans do not automatically renew.
        </p>
        <div className="flex gap-4 flex-wrap mt-6">
          <a href="/terms" className="underline min-h-11 inline-flex items-center">Terms</a>
          <a href="/privacy" className="underline min-h-11 inline-flex items-center">Privacy</a>
          <a href="/contact" className="underline min-h-11 inline-flex items-center">Payment support</a>
        </div>
      </main>
    </div>
  );
}
