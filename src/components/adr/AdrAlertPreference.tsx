import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Switch } from '../ui/Switch';

export function AdrAlertPreference() {
  const { user, profile, updateNotificationPreferences } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const epoch = useRef(0);
  const uid = user?.uid || '';
  useEffect(() => { epoch.current++; setBusy(false); setMessage(''); return () => { epoch.current++; }; }, [uid]);
  const change = async (enabled: boolean) => {
    const version = ++epoch.current;
    setBusy(true); setMessage('');
    try {
      const saved = await updateNotificationPreferences({ adrAlertsEnabled: enabled });
      if (version === epoch.current) setMessage(saved ? 'ADR alert preference saved.' : 'Could not save. Please retry.');
    } catch { if (version === epoch.current) setMessage('Could not save. Please retry.'); }
    finally { if (version === epoch.current) setBusy(false); }
  };
  return <section className="p-3.5 rounded-xl border border-slate-200 dark:border-[#2D283E]">
    <div className="flex items-center justify-between gap-4"><div><h3 className="text-sm font-semibold">Morning ADR alerts</h3><p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">One inbox alert per US session for watchlist moves of ±4% or more. Respects muted stocks and inbox mute.</p></div>
      <Switch label="Morning watchlist ADR alerts" checked={profile?.notificationPreferences?.adrAlertsEnabled === true} onChange={value => void change(value)} disabled={busy || !uid || user?.isAnonymous || profile?.uid !== uid} /></div>
    {message && <p role="status" className="text-xs mt-2 text-slate-500">{message}</p>}
  </section>;
}
