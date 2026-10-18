import React, { useState, useEffect } from 'react';
import { X, Share2, AlertCircle } from 'lucide-react';
import { requestPushPermission, getPushState, subscribePushState, initOneSignal, isIOS, isStandalonePWA } from '../utils/oneSignal';
import { RichIllustration } from './ui/RichVisual';

const DISMISS_KEY = 'bsenexus_push_prompt_dismissed_until';

export function PushNotificationBanner() {
  const [pushState, setPushState] = useState(getPushState);
  const [dismissed, setDismissed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Check if dismissed recently
    let dismissedUntil: string | null = null;
    try { dismissedUntil = localStorage.getItem(DISMISS_KEY); } catch {}
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      setDismissed(true);
    } else {
      setDismissed(false);
    }

    const unsubscribe = subscribePushState(setPushState);
    const refresh = () => { setPushState(getPushState()); initOneSignal(); };
    const onVisible = () => { if (!document.hidden) refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refresh);
    let active = true;
    let permissionStatus: PermissionStatus | null = null;
    // Not all browsers support the notifications Permissions query.
    navigator.permissions?.query({ name: 'notifications' as PermissionName }).then(status => {
      if (!active) return;
      permissionStatus = status;
      status.addEventListener('change', refresh);
    }).catch(() => {});
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      permissionStatus?.removeEventListener('change', refresh);
    };
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    setNotice(null);

    // On iOS outside standalone PWA, Apple blocks browser-tab push
    if (isIOS() && !isStandalonePWA()) {
      setLoading(false);
      setShowIosGuide(true);
      return;
    }

    try {
      const res = await requestPushPermission();
      if (res.granted) {
        setPushState(getPushState());
        setShowIosGuide(false);
        setDismissed(true);
      } else {
        if (res.reason === 'ios_requires_pwa') {
          setShowIosGuide(true);
        } else {
          setNotice(res.message);
        }
      }
    } catch {
      setNotice('Could not enable push. If using Brave, turn off Shields for this site.');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    // Dismiss for 7 days
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000)); } catch {}
  };

  // Check native permission even before the optional SDK has loaded, including
  // on reload/login. No local "enabled" flag can override browser permission.
  if (dismissed || pushState.permission === 'granted' || getPushState().permission === 'granted' || pushState.subscribed === true) return null;

  return (
    <>
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-2 mb-3">
        <div className="rich-push-banner">
          <div className="rich-push-copy">
            <RichIllustration kind="bell" className="rich-illustration-compact" />
            <div>
              <h4 className="rich-push-title text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Instant filing alerts</span>
              </h4>
              <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Get important filing updates, even when the tab is closed.
              </p>
              {notice && (
                <div className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-300 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{notice}</span>
                </div>
              )}
            </div>
          </div>

          <div className="rich-push-actions">
            <button
              onClick={handleEnable}
              disabled={loading}
              className="rich-action rich-action-primary px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Requesting…' : 'Allow alerts'}
            </button>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss banner"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS PWA Instruction Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => setShowIosGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-500 flex items-center justify-center mb-4">
              <Share2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              iPhone Notifications Setup
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
              Apple restricts Web Push inside Safari/Brave tabs. To receive alerts on iPhone:
            </p>

            <ol className="mt-3.5 space-y-2.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">1</span>
                <span>Tap the <b>Share button</b> in your browser.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">2</span>
                <span>Scroll through the menu and choose <b>"Add to Home Screen"</b>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">3</span>
                <span>Open BSE Nexus from your Home Screen, then allow alerts.</span>
              </li>
            </ol>

            <button
              onClick={() => setShowIosGuide(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
