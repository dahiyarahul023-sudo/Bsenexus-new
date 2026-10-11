import React, { useState, useEffect } from 'react';
import { Bell, BellRing, Check, X, Share2, Info, AlertCircle } from 'lucide-react';
import { requestPushPermission, isPushSubscribed, isIOS, isStandalonePWA } from '../utils/oneSignal';
import { RichIllustration } from './ui/RichVisual';

const DISMISS_KEY = 'bsenexus_push_prompt_dismissed_until';

export function PushNotificationBanner() {
  const [subscribed, setSubscribed] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Check if dismissed recently
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      setDismissed(true);
    } else {
      setDismissed(false);
    }

    // Check subscription status
    isPushSubscribed().then((isSub) => {
      setSubscribed(isSub);
      if (isSub) setDismissed(true); // Don't show banner if already subscribed
    });
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
        setSubscribed(true);
        setNotice('Push notifications enabled successfully!');
        setTimeout(() => setDismissed(true), 3000);
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
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
  };

  if (dismissed) return null;

  return (
    <>
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-2 mb-3">
        <div className="rich-push-banner">
          <div className="rich-push-copy">
            <RichIllustration kind={subscribed ? "success" : "bell"} className="rich-illustration-compact" />
            <div>
              <h4 className="rich-push-title text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Instant filing alerts</span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-blue-500/20 text-blue-600 dark:text-blue-300">Free for All</span>
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
            {subscribed ? (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                <Check className="w-3.5 h-3.5" /> Alerts Active
              </span>
            ) : (
              <button
                onClick={handleEnable}
                disabled={loading}
                className="rich-action rich-action-primary px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-60 cursor-pointer"
              >
                {loading ? 'Requesting…' : 'Allow alerts'}
              </button>
            )}
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
