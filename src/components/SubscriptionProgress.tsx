import React, { useEffect, useState } from 'react';
import { subscriptionProgress } from '../utils/subscriptionProgress';
export function SubscriptionProgress({ expiry, days, paidAt }: { expiry: number; days: number; paidAt: number | null }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); };
  }, []);
  const { daysLeft, percent } = subscriptionProgress(expiry, days, paidAt, now);
  return <div className="payment-access">
    <div className="payment-access-label"><strong>{daysLeft === 0 ? 'Access period ended' : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} remaining`}</strong><span>No auto-renewal</span></div>
    <div className="payment-access-track" role="progressbar" aria-label="Pro access remaining" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-valuetext={`${daysLeft} days remaining`}><div style={{ width: `${percent}%` }} /></div>
    <p>{daysLeft > 0 ? `Valid until ${new Date(expiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}` : 'Choose a plan whenever you need Pro again.'}</p>
  </div>;
}
