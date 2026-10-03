import React from 'react';
import { PRO_PLAN_LIST, getLowestPlanPrice } from '../config/plans';
import { PlanCard } from './ui/PlanCard';

export function PricingPage({ onChoosePlan }: { onChoosePlan: (planId: string) => void }) {
  return <div className="min-h-dvh bg-slate-50 dark:bg-[#0F0E15] text-slate-900 dark:text-white">
    <main className="max-w-6xl mx-auto px-4 py-10 sm:py-16">
      <a href="/" className="inline-flex min-h-11 items-center text-sm underline">Back to Bsenexus</a>
      <h1 className="mt-6 text-3xl sm:text-5xl font-bold">Pro plans from ₹{getLowestPlanPrice()}</h1>
      <p className="mt-4 max-w-2xl text-slate-500">Free public filings remain available. Pro plans are one-time purchases for the listed duration. Access begins after the server verifies payment.</p>
      <div className="grid gap-4 mt-8 sm:grid-cols-2 lg:grid-cols-4">
        {PRO_PLAN_LIST.map(plan => <PlanCard key={plan.id} title={plan.label} price={String(plan.price)} wasPrice={plan.wasPrice ? String(plan.wasPrice) : undefined} priceSuffix={`${plan.days} days`} sub={plan.sub} tag={plan.tag} ctaLabel={`Choose ${plan.label}`} onCta={() => onChoosePlan(plan.id)} />)}
      </div>
      <p className="mt-6 text-sm text-slate-500">Sign in before checkout. Renewals extend verified access; plans do not automatically renew.</p>
      <div className="flex gap-4 flex-wrap mt-6"><a href="/terms" className="underline min-h-11 inline-flex items-center">Terms</a><a href="/privacy" className="underline min-h-11 inline-flex items-center">Privacy</a><a href="/contact" className="underline min-h-11 inline-flex items-center">Payment support</a></div>
    </main>
  </div>;
}
