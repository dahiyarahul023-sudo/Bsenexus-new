import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Switch } from '../ui/Switch';

export function StoryNavigationPreference() {
  const { user, profile, updateNotificationPreferences, setIsAuthModalOpen } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const epoch = useRef(0);
  const uid = user?.uid || '';
  useEffect(() => { epoch.current++; setBusy(false); setMessage(''); return () => { epoch.current++; }; }, [uid]);
  const change = async (enabled: boolean) => {
    if (!uid || user?.isAnonymous || profile?.uid !== uid) { setIsAuthModalOpen?.(true); return; }
    const version = ++epoch.current;
    setBusy(true); setMessage('');
    try {
      const saved = await updateNotificationPreferences({ storyNavigationButtons: enabled });
      if (version === epoch.current) setMessage(saved ? 'Story preference saved.' : 'Could not save. Please retry.');
    } catch { if (version === epoch.current) setMessage('Could not save. Please retry.'); }
    finally { if (version === epoch.current) setBusy(false); }
  };
  return <div className="p-3.5 text-xs">
    <div className="flex items-center justify-between gap-3"><div><h4 className="font-semibold text-slate-900 dark:text-white">Story navigation buttons</h4><p className="text-[11px] text-slate-500 dark:text-slate-400">Show Previous, Pause and Next. Tap, swipe, hold and keyboard controls always work.</p></div>
      <Switch label="Story navigation buttons" checked={profile?.uid === uid ? profile?.notificationPreferences?.storyNavigationButtons !== false : true} onChange={value => void change(value)} disabled={busy} /></div>
    {message && <p role="status" className="text-slate-500 mt-2">{message}</p>}
  </div>;
}
