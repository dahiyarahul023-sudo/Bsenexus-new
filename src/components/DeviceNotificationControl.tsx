import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { getPushState, subscribePushState, initOneSignal, setDevicePushEnabled, isIOS, isStandalonePWA } from '../utils/oneSignal';
import { Switch } from './ui/Switch';

export function DeviceNotificationControl() {
  const [state, setState] = useState(getPushState);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const needsInstall = isIOS() && !isStandalonePWA();
  useEffect(() => {
    const unsubscribe = subscribePushState(setState);
    const refresh = () => { setState(getPushState()); initOneSignal(); };
    const visible = () => { if (!document.hidden) refresh(); };
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => { unsubscribe(); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', visible); };
  }, []);
  const change = async (enabled: boolean) => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try { const result = await setDevicePushEnabled(enabled); setNotice(result.message); setState(getPushState()); }
    catch { setNotice('Delivery could not be confirmed. Please retry.'); }
    finally { setBusy(false); }
  };
  const label = state.subscribed === true ? 'On' : state.permission === 'denied' ? 'Blocked in device settings' : state.permission === 'granted' && state.subscribed === null ? 'Delivery setup not confirmed' : 'Off';
  return <section className="device-notifications" aria-label="Device notifications" aria-busy={busy}>
    <div className="device-notifications-copy"><h3><Bell size={16} aria-hidden="true" />Device notifications</h3>
      <p>Important filing alerts on this phone or computer.</p>
      <span className="device-notifications-status">{busy ? 'Updating…' : label}</span>
    </div>
    <Switch label="Notifications on this device" checked={state.subscribed === true} disabled={busy} onChange={change} />
    {needsInstall && <p className="device-notifications-help">On iPhone, use Share → Add to Home Screen. Open the installed app, then turn notifications on here. Desktop permission does not enable your phone.</p>}
    {state.permission === 'denied' && <p className="device-notifications-help">Allow Bsenexus notifications in your browser or iPhone notification settings, then return here.</p>}
    {notice && <p className="device-notifications-help" role="status">{notice}</p>}
  </section>;
}
