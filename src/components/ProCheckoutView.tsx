import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldCheck, Check, Tag, Sparkles } from 'lucide-react';
import { BseNexusLogo } from './ui/BseNexusLogo';
import { customFetch } from '../api';
import { useAuth } from '../context/AuthContext';
import { startProPayment, formatReceiptDate, PRO_PLAN_LIST, getPlanDisplay } from '../utils/cashfree';
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

  // Referral state
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralInput, setReferralInput] = useState<string>('');
  const [isReferralApplied, setIsReferralApplied] = useState<boolean>(false);
  const [referralMessage, setReferralMessage] = useState<string | null>(null);
  const [validatingRef, setValidatingRef] = useState<boolean>(false);
  const [showReferralInput, setShowReferralInput] = useState<boolean>(false);
  const referralField = useRef<HTMLInputElement>(null);
  const referralRequest=useRef(0);

  const close = () => {
    if (!payingRef.current) setIsCheckoutOpen(false);
  };
  const dialog = usePaymentDialog(isCheckoutOpen, close);
  const heading = useRef<HTMLHeadingElement>(null);

  // Revalidate link/storage candidates against the server whenever checkout opens.
  useEffect(() => {
    if(!isCheckoutOpen||!user||user.isAnonymous)return;
    const controller=new AbortController();
    const stored=localStorage.getItem('bse_referral_code')||'';
    setIsReferralApplied(false);
    if(stored){setReferralInput(stored);void handleApplyReferral(stored,controller.signal);}
    return()=>controller.abort();
  },[isCheckoutOpen,user?.uid,user?.isAnonymous]);

  useEffect(() => {
    if (isCheckoutOpen) {
      setPlanId(checkoutPlanId);
      setReviewBaseId(checkoutPlanId);
      setStep('plan');
      setPaying(false);
      payingRef.current = false;
      setError(null);
    }
  }, [isCheckoutOpen, checkoutPlanId]);

  const move = (next: 'plan' | 'pay') => {
    if (payingRef.current) return;
    paymentFeedback();
    if (next === 'pay' && step === 'plan') setReviewBaseId(planId);
    setStep(next);
    setError(null);
  };

  useEffect(() => {
    if (isCheckoutOpen) heading.current?.focus({ preventScroll: true });
  }, [step, isCheckoutOpen]);

  useEffect(() => {
    if (!isCheckoutOpen || !showReferralInput || isReferralApplied) return;
    const frame = requestAnimationFrame(() => {
      referralField.current?.focus({ preventScroll: true });
      referralField.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, [showReferralInput, isCheckoutOpen, step, isReferralApplied]);

  if (!isCheckoutOpen) return null;

  const plan = getPlanDisplay(planId);
  const orderedPlans = [...PRO_PLAN_LIST].sort((a, b) => a.days - b.days);
  const reviewIndex = Math.max(0, orderedPlans.findIndex((p) => p.id === reviewBaseId));
  const reviewPlans = orderedPlans.slice(reviewIndex, reviewIndex + 2);

  // Effective charged price and discount breakdown
  const currentPrice = isReferralApplied ? plan.referralPrice : plan.price;
  const referralDiscount = isReferralApplied ? plan.referralDiscount : 0;

  const handleApplyReferral = async (codeToTry: string, signal?:AbortSignal) => {
    const request=++referralRequest.current;
    const clean = codeToTry.trim().toUpperCase();
    if (!clean) return;
    setValidatingRef(true);
    setError(null);
    try {
      const res = await customFetch('/api/referrals/apply', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:clean}),signal});
      const data = await res.json();
      if(signal?.aborted||request!==referralRequest.current)return;
      if (res.ok && data?.success) {
        setReferralCode(clean);
        setIsReferralApplied(true);
        setReferralMessage(data.discountMessage || `Referral code ${clean} applied! Flat ₹100 OFF on Monthly.`);
        if (typeof window !== 'undefined') {
          localStorage.setItem('bse_referral_code', clean);
        }
        setShowReferralInput(false);
      } else {
        setError(data?.error || 'Invalid or inactive referral code.');
      }
    } catch {
      if(!signal?.aborted&&request===referralRequest.current)setError('Could not validate referral code.');
    } finally {
      if(request===referralRequest.current)setValidatingRef(false);
    }
  };

  const handleRemoveReferral = async () => {
    referralRequest.current++;
    try {
      const response=await customFetch('/api/referrals/apply',{method:'DELETE'});
      if(!response.ok){setError('Could not remove the applied code. Please retry.');return;}
    } catch {setError('Could not remove the applied code. Please retry.');return;}
    setIsReferralApplied(false);
    setReferralCode('');
    setReferralInput('');
    setReferralMessage(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bse_referral_code');
    }
  };

  const email = user?.email || profile?.email || 'Your account';

  const handlePay = async () => {
    if (payingRef.current) return;
    if (!user || user.isAnonymous) {
      setError('Please sign in to your account before paying.');
      return;
    }
    payingRef.current = true;
    setPaying(true);
    setError(null);
    paymentFeedback();
    try {
      const result = await startProPayment(plan.id, isReferralApplied ? referralCode : undefined);
      if (!result.ok) {
        setError(result.error || 'Could not start payment. Please try again.');
        payingRef.current = false;
        setPaying(false);
      }
    } catch {
      setError('Could not open checkout. Please try again.');
      payingRef.current = false;
      setPaying(false);
    }
  };

  return (
    <div
      ref={dialog}
      className={`payment-ui payment-overlay ${step === 'pay' ? 'payment-review-overlay' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-title"
      onClick={close}
    >
      <div className={`payment-sheet ${step === 'pay' ? 'payment-sheet-compact' : ''}`} onClick={(e) => e.stopPropagation()}>
        {step === 'pay' && <div className="payment-sheet-handle" aria-hidden="true" />}
        <header className="payment-header">
          {step === 'pay' && (
            <span className="payment-brand" aria-label="Bsenexus">
              <BseNexusLogo size="lg" />
            </span>
          )}
          <div>
            <p className="payment-eyebrow">BSE NEXUS · PRO</p>
            <h2 id="payment-title" ref={heading} tabIndex={-1}>
              {step === 'plan' ? 'Choose your Pro plan' : 'Upgrade to Pro'}
            </h2>
          </div>
          <button className="payment-icon" onClick={close} disabled={paying} aria-label="Close checkout">
            <X size={20} />
          </button>
        </header>

        <nav className="payment-steps" aria-label="Checkout steps">
          <button
            type="button"
            className={step === 'plan' ? 'active' : ''}
            aria-current={step === 'plan' ? 'step' : undefined}
            onClick={() => move('plan')}
            disabled={paying}
          >
            1 · Choose plan
          </button>
          <button
            type="button"
            className={step === 'pay' ? 'active' : ''}
            aria-current={step === 'pay' ? 'step' : undefined}
            onClick={() => move('pay')}
            disabled={paying}
          >
            2 · Review &amp; pay
          </button>
        </nav>

        <div key={step} className="payment-content payment-enter">
          {step === 'plan' ? (
            <>
              <p className="payment-muted">One-time plans. All Pro features included.</p>

              {/* Referral Code Banner / Toggle */}
              <div className={`payment-referral-box ${isReferralApplied ? 'payment-referral-active' : ''}`}>
                <div className="payment-referral-row">
                  {isReferralApplied ? (
                    <>
                      <span className="payment-referral-badge">
                        <Sparkles size={14} />
                        <span>Referral <strong>{referralCode}</strong> applied</span>
                        <span className="payment-referral-discount-pill">
                          {planId === 'pro_monthly' ? '₹100 OFF' : `₹${plan.referralDiscount} OFF`}
                        </span>
                      </span>
                      <button type="button" className="payment-referral-remove" disabled={paying || validatingRef} onClick={handleRemoveReferral}>
                        Remove
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="payment-referral-prompt">
                        <Tag size={13} /> Have a referral code?
                      </span>
                      <button
                        type="button"
                        className="payment-referral-toggle"
                        aria-expanded={showReferralInput}
                        aria-controls="checkout-referral-form"
                        disabled={paying || validatingRef}
                        onClick={() => setShowReferralInput(!showReferralInput)}
                      >
                        {showReferralInput ? 'Cancel' : 'Enter code'}
                      </button>
                    </>
                  )}
                </div>

                {!isReferralApplied && showReferralInput && (
                  <form
                    id="checkout-referral-form"
                    aria-busy={validatingRef}
                    className="payment-referral-input-group"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleApplyReferral(referralInput);
                    }}
                  >
                    <input
                      ref={referralField}
                      aria-label="Referral code"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      enterKeyHint="done"
                      disabled={paying || validatingRef}
                      type="text"
                      placeholder="Enter referral code"
                      value={referralInput}
                      onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                      maxLength={20}
                    />
                    <button type="submit" disabled={paying || validatingRef || !referralInput.trim()}>
                      {validatingRef ? 'Verifying…' : 'Apply'}
                    </button>
                  </form>
                )}
                {referralMessage && isReferralApplied && (
                  <p role="status" className="payment-referral-message">{referralMessage}</p>
                )}
              </div>

              <div className="payment-plan-grid" role="group" aria-label="Pro plans">
                {PRO_PLAN_LIST.map((p) => {
                  const effectiveP = isReferralApplied ? p.referralPrice : p.price;
                  return (
                    <button
                      key={p.id}
                      className={`payment-plan ${p.id === plan.id ? 'selected' : ''}`}
                      aria-pressed={p.id === plan.id}
                      onClick={() => {
                        paymentFeedback();
                        setPlanId(p.id);
                      }}
                    >
                      <span className="payment-plan-top">
                        <strong>{p.label}</strong>
                        <span className="payment-radio" aria-hidden="true">
                          {p.id === plan.id && <Check size={13} />}
                        </span>
                      </span>
                      {p.tag && <span className="payment-tag">{p.tag}</span>}
                      <span className="payment-duration">{p.days} days access</span>
                      <span className="payment-price">
                        {isReferralApplied && (
                          <span className="line-through text-slate-400 text-sm mr-2 font-normal">
                            ₹{p.price.toLocaleString('en-IN')}
                          </span>
                        )}
                        ₹{effectiveP.toLocaleString('en-IN')}
                        <small>one-time</small>
                      </span>
                      <span className="payment-saving">
                        {isReferralApplied
                          ? p.id === 'pro_monthly'
                            ? 'Flat ₹100 OFF with referral'
                            : `Save ₹${p.referralDiscount} with referral`
                          : p.sub}
                      </span>
                    </button>
                  );
                })}
              </div>

              <section className="payment-comparison" aria-labelledby="payment-comparison-title">
                <h3 id="payment-comparison-title">Compare Free and Pro</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>Free</th>
                      <th>Pro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Watchlists', '—', 'Unlimited'],
                      ['AI summaries', '1 demo', '100/day'],
                      ['Telegram alerts', '—', 'Personal alerts'],
                      ['CSV / JSON export', '—', 'Included'],
                    ].map((row) => (
                      <tr key={row[0]}>
                        {row.map((s, i) => (i === 0 ? <th scope="row" key={s}>{s}</th> : <td key={i}>{s}</td>))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          ) : (
            <>
              <p className="payment-review-label">Billing period</p>
              <div
                className={`payment-review-options ${reviewPlans.length === 1 ? 'single' : ''}`}
                role="group"
                aria-label="Selected plan and next larger plan"
              >
                {reviewPlans.map((p) => {
                  const effectiveP = isReferralApplied ? p.referralPrice : p.price;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      className={`payment-review-option ${p.id === plan.id ? 'selected' : ''}`}
                      aria-pressed={p.id === plan.id}
                      disabled={paying}
                      onClick={() => {
                        paymentFeedback();
                        setPlanId(p.id);
                        setError(null);
                      }}
                    >
                      <span>
                        <strong>{p.label}</strong>
                        <small>{p.days} days · one-time</small>
                      </span>
                      <span className="payment-option-price">₹{effectiveP.toLocaleString('en-IN')}</span>
                    </button>
                  );
                })}
              </div>

              {/* Referral code in Review Step */}
              <div className={`payment-referral-box mt-3 mb-3 ${isReferralApplied ? 'payment-referral-active' : ''}`}>
                <div className="payment-referral-row">
                  {isReferralApplied ? (
                    <>
                      <span className="payment-referral-badge">
                        <Sparkles size={14} />
                        <span>Referral <strong>{referralCode}</strong> applied</span>
                      </span>
                      <button type="button" className="payment-referral-remove" disabled={paying || validatingRef} onClick={handleRemoveReferral}>
                        Remove
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="payment-referral-prompt">
                        <Tag size={13} /> Have a referral code?
                      </span>
                      <button
                        type="button"
                        className="payment-referral-toggle"
                        aria-expanded={showReferralInput}
                        aria-controls="checkout-referral-form"
                        disabled={paying || validatingRef}
                        onClick={() => setShowReferralInput(!showReferralInput)}
                      >
                        {showReferralInput ? 'Cancel' : 'Enter code'}
                      </button>
                    </>
                  )}
                </div>

                {!isReferralApplied && showReferralInput && (
                  <form
                    id="checkout-referral-form"
                    aria-busy={validatingRef}
                    className="payment-referral-input-group"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleApplyReferral(referralInput);
                    }}
                  >
                    <input
                      ref={referralField}
                      aria-label="Referral code"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      enterKeyHint="done"
                      disabled={paying || validatingRef}
                      type="text"
                      placeholder="Enter referral code"
                      value={referralInput}
                      onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                      maxLength={20}
                    />
                    <button type="submit" disabled={paying || validatingRef || !referralInput.trim()}>
                      {validatingRef ? 'Verifying…' : 'Apply'}
                    </button>
                  </form>
                )}
              </div>

              <div className="payment-account payment-review-account">
                <span className="payment-muted">Account</span>
                <strong>{email}</strong>
              </div>

              <div className="payment-order-total" aria-live="polite">
                <div>
                  <strong>Total price</strong>
                  <strong>₹{currentPrice.toLocaleString('en-IN')}</strong>
                </div>
                {isReferralApplied ? (
                  <div className="payment-discount text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Referral Discount ({referralCode})</span>
                    <span>-₹{referralDiscount.toLocaleString('en-IN')} (FLAT DISCOUNT)</span>
                  </div>
                ) : (
                  <div className="payment-discount">
                    <span>Regular Price</span>
                    <span>₹{plan.price.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>

              <details className="payment-extra-details">
                <summary>Payment details</summary>
                <dl className="payment-details">
                  <div>
                    <dt>Pay to</dt>
                    <dd>Bsenexus</dd>
                  </div>
                  <div>
                    <dt>Pay on</dt>
                    <dd>{formatReceiptDate(new Date().toISOString())}</dd>
                  </div>
                  {isReferralApplied && (
                    <div>
                      <dt>Referral partner</dt>
                      <dd>{referralCode}</dd>
                    </div>
                  )}
                </dl>
              </details>
            </>
          )}
          {error && (
            <p className="payment-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <footer className="payment-footer">
          {step === 'plan' && (
            <div className="payment-selection" aria-live="polite">
              <span>
                {plan.label} · {plan.days} days
              </span>
              <strong>₹{currentPrice.toLocaleString('en-IN')}</strong>
            </div>
          )}
          <button
            className="payment-primary"
            disabled={paying || validatingRef}
            onClick={step === 'plan' ? () => move('pay') : handlePay}
          >
            {paying ? 'Opening secure checkout…' : step === 'plan' ? `Continue — ₹${currentPrice}` : `Pay ₹${currentPrice}`}
          </button>
          {step === 'pay' && (
            <button type="button" className="payment-later" disabled={paying} onClick={close}>
              Maybe later
            </button>
          )}
          <p className="payment-trust">
            <ShieldCheck size={14} />
            Cashfree · UPI · Cards · Netbanking
          </p>
          {step === 'pay' && <p className="payment-renewal-note">One-time payment · No automatic renewal</p>}
        </footer>
      </div>
    </div>
  );
}
