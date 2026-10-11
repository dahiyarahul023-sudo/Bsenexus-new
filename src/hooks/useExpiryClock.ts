import { useEffect, useState } from 'react';

/** Re-evaluate entitlement at expiry, including when a suspended tab resumes. */
export function useExpiryClock(expiresAt?: number, identity?: string) {
  const [entitlementClock, setEntitlementClock] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const current = Date.now();
      setEntitlementClock(current);
      clearTimeout(timer);
      const remaining = Number(expiresAt || 0) - current;
      if (remaining > 0) timer = setTimeout(update, Math.min(remaining + 10, 2147483647));
    };
    const visible = () => { if (document.visibilityState === 'visible') update(); };
    update();
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [expiresAt, identity]);
  return Math.max(entitlementClock, Date.now());
}
