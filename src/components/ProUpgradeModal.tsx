import React, { useState } from 'react';
import {
  X, Check, Sparkles, ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePaymentDialog } from '../hooks/usePaymentDialog';
import '../styles/payment.css';
import { PlanCard } from './ui/PlanCard';
import { RichIllustration } from './ui/RichVisual';
import { hasUsedTrial, getPlanDisplay, getLowestPlanPrice } from '../utils/cashfree';

export function ProUpgradeModal() {
  const { 
    isProModalOpen, 
    setIsProModalOpen,
    checkoutPlanId,
    openCheckout,
    profile, 
    user,
    setIsAuthModalOpen, 
    upgradeToPro 
  } = useAuth();

  const [isActivating, setIsActivating] = useState(false);
  const [activatedSuccess, setActivatedSuccess] = useState(false);
  const dialog = usePaymentDialog(isProModalOpen, () => { if (!isActivating) setIsProModalOpen(false); });
  // Pricing comes from the single source of truth (src/config/plans.ts) —
  // never hardcode plan prices in this component.
  const monthlyPlan = getPlanDisplay('pro_monthly');

  if (!isProModalOpen) return null;

  // Trial already consumed → offer direct purchase instead of a second trial.
  const trialUsed = hasUsedTrial((user as any)?.uid || profile?.uid);
  const showPayMode = Boolean(user && !user.isAnonymous && trialUsed);

  const handleBuyPro = () => {
    // Enter the dedicated checkout screen — payment happens inside it.
    // Keeps the plan preselected from the /pricing deep link, if any.
    setIsProModalOpen(false);
    openCheckout(checkoutPlanId);
  };

  const handleActivate = async () => {
    if (!user || user.isAnonymous) {
      setIsProModalOpen(false);
      setIsAuthModalOpen(true);
      return;
    }

    setIsActivating(true);
    const success = await upgradeToPro('7-Day Pro Trial');
    setIsActivating(false);
    if (success) {
      setActivatedSuccess(true);
      setTimeout(() => {
        setIsProModalOpen(false);
        setActivatedSuccess(false);
      }, 1500);
    }
  };

  return (
    <div 
      ref={dialog}
      className="payment-ui payment-overlay payment-upgrade"
      onClick={() => { if (!isActivating) setIsProModalOpen(false); }}
      role="dialog"
      aria-modal="true"
      aria-label="Pro upgrade"
    >
      <div
        className="relative max-w-lg w-full animate-in zoom-in-95 duration-200 overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => { if (!isActivating) setIsProModalOpen(false); }}
          aria-label="Close upgrade modal"
          className="absolute -top-3 -right-3 z-10 p-2 rounded-full bg-[#121212] dark:bg-white text-white dark:text-black shadow-lg hover:opacity-85 transition-opacity"
        >
          <X size={16} />
        </button>

        {activatedSuccess ? (
          <div className="rounded-[20px] border border-[#E2E2E2] dark:border-white/10 bg-[#FCFCFC] dark:bg-[#16161B] p-10 flex flex-col items-center gap-3 text-center shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            <RichIllustration kind="success" />
            <p className="text-[20px] font-medium tracking-[-0.02em] text-[#121212] dark:text-white">
              1-Week Free Pro Activated!
            </p>
            <p className="text-[13px] text-[#7B7B7B] dark:text-zinc-400">
              Enjoy unlimited watchlists, Telegram alerts and Gemini AI summaries.
            </p>
          </div>
        ) : (
          <PlanCard
            title={showPayMode ? 'Continue with Pro Intelligence' : 'Try Pro for 7 days'}
            subtitle={
              showPayMode
                ? 'Your free trial has ended. Keep unlimited watchlists, Gemini AI summaries, Telegram alerts and custom filtering.'
                : 'Explore AI summaries, personal Telegram alerts and unlimited watchlists. No card required.'
            }
            tag={showPayMode ? 'Launch Offer' : '1-Week Free Trial'}
            wasPrice={showPayMode && monthlyPlan.wasPrice ? String(monthlyPlan.wasPrice) : undefined}
            price={showPayMode ? String(monthlyPlan.price) : '0'}
            priceSuffix={showPayMode ? '/month' : '/week'}
            sub={showPayMode ? monthlyPlan.sub : `After the free week, one-time plans from ₹${getLowestPlanPrice()}`}
            features={[
              {
                title: 'Personal Telegram Instant Alerts',
                desc: 'Get instant DMs on your personal Telegram account whenever your selected stocks submit a BSE filing.',
              },
              {
                title: 'Custom Category Filtering',
                desc: 'Choose exactly what you receive: Financial Results, Order Wins, Dividends/Bonus, or M&A while muting compliance spam.',
              },
              {
                title: 'Unlimited Watchlist Stocks',
                desc: 'Track unlimited scrips with automatic historical filings sync & financial results archive.',
              },
              {
                title: 'Gemini AI YoY Financial Breakdowns',
                desc: 'Up to 100 summaries per day, with revenue, profit, margins and key takeaways.',
              },
            ]}
            ctaLabel={
              showPayMode ? (
                <span className="inline-flex items-center gap-2">
                  <Sparkles size={16} /> Continue to Secure Checkout <ArrowRight size={15} />
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Sparkles size={16} />
                  {(!user || user.isAnonymous)
                    ? 'Sign in to start free trial'
                    : 'Start free trial — ₹0'}
                  <ArrowRight size={15} />
                </span>
              )
            }
            onCta={showPayMode ? handleBuyPro : handleActivate}
            ctaLoading={!showPayMode && isActivating}
            ctaLoadingText="Activating..."
            footnote={
              <>
                Free trial: No card required upfront · After the free week, Pro continues with
                one-time plans from ₹{getLowestPlanPrice()} · No automatic renewal.
              </>
            }
            className="w-full"
          />
        )}
      </div>
    </div>
  );
}

