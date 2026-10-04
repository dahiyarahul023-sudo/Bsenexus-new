import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldCheck, Check } from 'lucide-react';
import { BseNexusLogo } from './ui/BseNexusLogo';
import { useAuth } from '../context/AuthContext';
import { startProPayment, formatReceiptDate, PRO_PLAN_LIST } from '../utils/cashfree';
import { usePaymentDialog } from '../hooks/usePaymentDialog';
import { paymentFeedback } from '../utils/paymentFeedback';
import '../styles/payment.css';

export function ProCheckoutView() {
  const { isCheckoutOpen, setIsCheckoutOpen, checkoutPlanId, user, profile } = useAuth();
  const [planId, setPlanId] = useState(checkoutPlanId);
  const [reviewBaseId, setReviewBaseId] = useState(checkoutPlanId);
  const [step, setStep] = useState<'plan' | 'pay'>('plan');
  const [paying, setPaying] = useState(false);
  const payingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => { if (!payingRef.current) setIsCheckoutOpen(false); };
  const dialog = usePaymentDialog(isCheckoutOpen, close);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (isCheckoutOpen) { setPlanId(checkoutPlanId); setReviewBaseId(checkoutPlanId); setStep('plan'); setPaying(false); payingRef.current = false; setError(null); }
  }, [isCheckoutOpen, checkoutPlanId]);
  const move = (next: 'plan' | 'pay') => { if (payingRef.current) return; paymentFeedback(); if (next === 'pay' && step === 'plan') setReviewBaseId(planId); setStep(next); setError(null); };
  useEffect(() => { if (isCheckoutOpen) heading.current?.focus({ preventScroll: true }); }, [step, isCheckoutOpen]);
  if (!isCheckoutOpen) return null;
  const plan = PRO_PLAN_LIST.find(p => p.id === planId) || PRO_PLAN_LIST[1];
  const orderedPlans = [...PRO_PLAN_LIST].sort((a, b) => a.days - b.days);
  const reviewIndex = Math.max(0, orderedPlans.findIndex(p => p.id === reviewBaseId));
  const reviewPlans = orderedPlans.slice(reviewIndex, reviewIndex + 2);
  const discount = plan.wasPrice && plan.wasPrice > plan.price
    ? `₹${(plan.wasPrice - plan.price).toLocaleString('en-IN')} launch discount`
    : plan.sub.startsWith('Save ') ? plan.sub.slice(5) : 'No discount';
  const email = user?.email || profile?.email || 'Your account';
  const handlePay = async () => {
    if (payingRef.current) return;
    if (!user || user.isAnonymous) { setError('Please sign in to your account before paying.'); return; }
    payingRef.current = true; setPaying(true); setError(null); paymentFeedback();
    try {
      const result = await startProPayment(plan.id);
      if (!result.ok) { setError(result.error || 'Could not start payment. Please try again.'); payingRef.current = false; setPaying(false); }
    } catch { setError('Could not open checkout. Please try again.'); payingRef.current = false; setPaying(false); }
  };
  return <div ref={dialog} className={`payment-ui payment-overlay ${step === 'pay' ? 'payment-review-overlay' : ''}`}  role="dialog" aria-modal="true" aria-labelledby="payment-title" onClick={close}>
    <div className={`payment-sheet ${step === 'pay' ? 'payment-sheet-compact' : ''}`}  onClick={e => e.stopPropagation()}>
      {step === 'pay' && <div className="payment-sheet-handle" aria-hidden="true" />}
      <header className="payment-header">{step === 'pay' && <span className="payment-brand" aria-label="Bsenexus"><BseNexusLogo size="lg" /></span>}<div><p className="payment-eyebrow">BSE NEXUS · PRO</p><h2 id="payment-title" ref={heading} tabIndex={-1}>{step === 'plan' ? 'Choose your Pro plan' : 'Upgrade to Pro'}</h2></div><button className="payment-icon" onClick={close} disabled={paying} aria-label="Close checkout"><X size={20}/></button></header>
      <nav className="payment-steps" aria-label="Checkout steps"><button type="button" className={step === 'plan' ? 'active' : ''} aria-current={step === 'plan' ? 'step' : undefined} onClick={() => move('plan')} disabled={paying}>1 · Choose plan</button><button type="button" className={step === 'pay' ? 'active' : ''} aria-current={step === 'pay' ? 'step' : undefined} onClick={() => move('pay')} disabled={paying}>2 · Review &amp; pay</button></nav>
      <div key={step} className="payment-content payment-enter">
        {step === 'plan' ? <>
          <p className="payment-muted">One-time plans. All Pro features included.</p>
          <div className="payment-plan-grid" role="group" aria-label="Pro plans">{PRO_PLAN_LIST.map(p => <button key={p.id} className={`payment-plan ${p.id === plan.id ? 'selected' : ''}`} aria-pressed={p.id === plan.id} onClick={() => { paymentFeedback(); setPlanId(p.id); }}>
            <span className="payment-plan-top"><strong>{p.label}</strong><span className="payment-radio" aria-hidden="true">{p.id === plan.id && <Check size={13}/>}</span></span>
            {p.tag && <span className="payment-tag">{p.tag}</span>}
            <span className="payment-duration">{p.days} days access</span><span className="payment-price">₹{p.price.toLocaleString('en-IN')}<small>one-time</small></span><span className="payment-saving">{p.sub}</span>
          </button>)}</div>
          <section className="payment-comparison" aria-labelledby="payment-comparison-title"><h3 id="payment-comparison-title">Compare Free and Pro</h3><table><thead><tr><th>Feature</th><th>Free</th><th>Pro</th></tr></thead><tbody>{[['Watchlists','—','Unlimited'],['AI summaries','1 demo','100/day'],['Telegram alerts','—','Personal alerts'],['CSV / JSON export','—','Included']].map(row => <tr key={row[0]}>{row.map((s,i) => i === 0 ? <th scope="row" key={s}>{s}</th> : <td key={i}>{s}</td>)}</tr>)}</tbody></table></section>
        </> : <>
          <p className="payment-review-label">Billing period</p>
          <div className={`payment-review-options ${reviewPlans.length === 1 ? 'single' : ''}`} role="group" aria-label="Selected plan and next larger plan">
            {reviewPlans.map(p => <button type="button" key={p.id} className={`payment-review-option ${p.id === plan.id ? 'selected' : ''}`} aria-pressed={p.id === plan.id} disabled={paying} onClick={() => { paymentFeedback(); setPlanId(p.id); setError(null); }}>
              <span><strong>{p.label}</strong><small>{p.days} days · one-time</small></span><span className="payment-option-price">₹{p.price.toLocaleString('en-IN')}</span>
            </button>)}
          </div>
          <div className="payment-account payment-review-account"><span className="payment-muted">Account</span><strong>{email}</strong></div>
          <div className="payment-order-total" aria-live="polite"><div><strong>Total price</strong><strong>₹{plan.price.toLocaleString('en-IN')}</strong></div><div className="payment-discount"><span>Discount</span><span>{discount}</span></div></div>
          <details className="payment-extra-details"><summary>Payment details</summary><dl className="payment-details"><div><dt>Pay to</dt><dd>Bsenexus</dd></div><div><dt>Pay on</dt><dd>{formatReceiptDate(new Date().toISOString())}</dd></div></dl></details>
        </>}
        {error && <p className="payment-error" role="alert">{error}</p>}
      </div>
      <footer className="payment-footer">{step === 'plan' && <div className="payment-selection" aria-live="polite"><span>{plan.label} · {plan.days} days</span><strong>₹{plan.price.toLocaleString('en-IN')}</strong></div>}<button className="payment-primary" disabled={paying} onClick={step === 'plan' ? () => move('pay') : handlePay}>{paying ? 'Opening secure checkout…' : step === 'plan' ? `Continue — ₹${plan.price}` : 'Pay'}</button>{step === 'pay' && <button type="button" className="payment-later" disabled={paying} onClick={close}>Maybe later</button>}<p className="payment-trust"><ShieldCheck size={14}/>Cashfree · UPI · Cards · Netbanking</p>{step === 'pay' && <p className="payment-renewal-note">One-time payment · No automatic renewal</p>}</footer>
    </div>
  </div>;
}
