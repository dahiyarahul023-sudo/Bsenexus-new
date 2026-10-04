import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldCheck, ChevronLeft, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { startProPayment, formatReceiptDate, PRO_PLAN_LIST } from '../utils/cashfree';
import { usePaymentDialog } from '../hooks/usePaymentDialog';
import { paymentFeedback } from '../utils/paymentFeedback';
import '../styles/payment.css';

export function ProCheckoutView() {
  const { isCheckoutOpen, setIsCheckoutOpen, checkoutPlanId, user, profile } = useAuth();
  const [planId, setPlanId] = useState(checkoutPlanId);
  const [step, setStep] = useState<'plan' | 'pay'>('plan');
  const [paying, setPaying] = useState(false);
  const payingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => { if (!payingRef.current) setIsCheckoutOpen(false); };
  const dialog = usePaymentDialog(isCheckoutOpen, close);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (isCheckoutOpen) { setPlanId(checkoutPlanId); setStep('plan'); setPaying(false); payingRef.current = false; setError(null); }
  }, [isCheckoutOpen, checkoutPlanId]);
  const move = (next: 'plan' | 'pay') => { if (payingRef.current) return; paymentFeedback(); setStep(next); setError(null); };
  useEffect(() => { if (isCheckoutOpen) heading.current?.focus({ preventScroll: true }); }, [step, isCheckoutOpen]);
  if (!isCheckoutOpen) return null;
  const plan = PRO_PLAN_LIST.find(p => p.id === planId) || PRO_PLAN_LIST[1];
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
  return <div ref={dialog} className="payment-ui payment-overlay" role="dialog" aria-modal="true" aria-labelledby="payment-title" onClick={close}>
    <div className="payment-sheet" onClick={e => e.stopPropagation()}>
      <header className="payment-header"><div><p className="payment-eyebrow">BSE NEXUS · PRO</p><h2 id="payment-title" ref={heading} tabIndex={-1}>{step === 'plan' ? 'Choose your Pro plan' : 'Review your payment'}</h2></div><button className="payment-icon" onClick={close} disabled={paying} aria-label="Close checkout"><X size={20}/></button></header>
      <div className="payment-steps" aria-label={`Step ${step === 'plan' ? 1 : 2} of 2`}><span className={step === 'plan' ? 'active' : ''}>1 · Choose plan</span><span className={step === 'pay' ? 'active' : ''}>2 · Review & pay</span></div>
      <div key={step} className="payment-content payment-enter">
        {step === 'plan' ? <>
          <p className="payment-muted">One-time plans. All Pro features included.</p>
          <div className="payment-plan-grid" role="group" aria-label="Pro plans">{PRO_PLAN_LIST.map(p => <button key={p.id} className={`payment-plan ${p.id === plan.id ? 'selected' : ''}`} aria-pressed={p.id === plan.id} onClick={() => { paymentFeedback(); setPlanId(p.id); }}>
            <span className="payment-plan-top"><strong>{p.label}</strong><span className="payment-radio" aria-hidden="true">{p.id === plan.id && <Check size={13}/>}</span></span>
            {p.tag && <span className="payment-tag">{p.tag}</span>}
            <span className="payment-duration">{p.days} days access</span><span className="payment-price">₹{p.price.toLocaleString('en-IN')}<small>one-time</small></span><span className="payment-saving">{p.sub}</span>
          </button>)}</div>
          <details className="payment-comparison"><summary>Compare Free and Pro</summary><table><thead><tr><th>Feature</th><th>Free</th><th>Pro</th></tr></thead><tbody>{[['Watchlists','—','Unlimited'],['AI summaries','1 demo','100/day'],['Telegram alerts','—','Personal alerts'],['CSV / JSON export','—','Included']].map(row => <tr key={row[0]}>{row.map((s,i) => i === 0 ? <th scope="row" key={s}>{s}</th> : <td key={i}>{s}</td>)}</tr>)}</tbody></table></details>
        </> : <><button className="payment-back" onClick={() => move('plan')} disabled={paying}><ChevronLeft size={16}/>Change plan</button><div className="payment-review-grid"><div className="payment-pack"><span className="payment-tag">{plan.days} days access</span><h3>{plan.label}</h3><div className="payment-total">₹{plan.price.toLocaleString('en-IN')}</div><p className="payment-saving">{plan.sub}</p><p className="payment-muted">One-time purchase. No automatic renewal.</p></div><dl className="payment-details"><div><dt>Account</dt><dd>{email}</dd></div><div><dt>Pay to</dt><dd>Bsenexus</dd></div><div><dt>Pay on</dt><dd>{formatReceiptDate(new Date().toISOString())}</dd></div><div><dt>Total</dt><dd><strong>₹{plan.price.toLocaleString('en-IN')}.00</strong></dd></div></dl></div></>}
        {error && <p className="payment-error" role="alert">{error}</p>}
      </div>
      <footer className="payment-footer"><div className="payment-selection" aria-live="polite"><span>{plan.label} · {plan.days} days</span><strong>₹{plan.price.toLocaleString('en-IN')}</strong></div><button className="payment-primary" disabled={paying} onClick={step === 'plan' ? () => move('pay') : handlePay}>{paying ? 'Opening secure checkout…' : step === 'plan' ? `Continue — ₹${plan.price}` : `Pay ₹${plan.price}`}</button><p className="payment-trust"><ShieldCheck size={14}/>Cashfree · UPI · Cards · Netbanking</p></footer>
    </div>
  </div>;
}
