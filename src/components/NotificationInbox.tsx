import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, BellOff, CheckCircle2, Trash2, Check, ExternalLink, 
  Sparkles, Filter, Clock, Building2, ChevronRight,
  BarChart3, Coins, Gift, Award, Zap, AlertTriangle, Settings, X, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  springSnappy, 
  springStandard,
  containerStaggerVariants, 
  itemFadeUpVariants, 
  notificationItemVariants,
  buttonTap 
} from '../utils/motionTokens';
import { customFetch } from '../api';
import { getSafePdfUrl } from '../utils/pdfHelper';
import { formatTimeOnly, formatDateOnly } from '../utils/timeFormat';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useVisibilityInterval } from '../hooks/useVisibilityInterval';
import { useAuth } from '../context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface InAppNotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'RESULT' | 'DIVIDEND' | 'BONUS' | 'SPLIT' | 'BONUS_SPLIT' | 'BUYBACK' | 'ORDER_WIN' | 'BOARD_MEETING' | 'GOVERNANCE' | 'RULE_MATCH' | 'GENERAL';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  symbol?: string;
  scripCode?: string;
  newsId?: string;
  pdfLink?: string;
  timestamp: number;
  isRead: boolean;
  isWatchlist?: boolean;
}

interface NotificationInboxProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCompanyIntel: (scripCode?: string, symbol?: string, companyName?: string) => void;
  onOpenAlertRules: () => void;
  unreadCount: number | null;
  onRefreshCount: () => void;
}

export function NotificationInbox({
  isOpen,
  onClose,
  onOpenCompanyIntel,
  onOpenAlertRules,
  unreadCount,
  onRefreshCount
}: NotificationInboxProps) {
  useBodyScrollLock(isOpen);
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<InAppNotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'WATCHLIST' | 'RESULTS' | 'ACTIONS' | 'UNREAD' | 'ALL'>('UNREAD');
  const filterRef = useRef(activeFilter); filterRef.current = activeFilter;
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isTogglingMute, setIsTogglingMute] = useState<boolean>(false);
  // Race guard: panel open/filter change fires loadNotifications + fetchMuteStatus.
  // If the user toggles mute before those slow responses arrive, the stale
  // response must NOT overwrite the newer toggle — this was the "mute only
  // shows after close/reopen" bug.
  const owner = user?.uid || profile?.uid || 'guest';
  const ownerRef = useRef(owner); ownerRef.current = owner;
  const readBusy = useRef(new Set<string>());
  const muteSeqRef = useRef(0);
  const loadSeqRef = useRef(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{error:boolean;message:string} | null>(null);
  const clearConfirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      if (isClearing) return;
      if (confirmClear) setConfirmClear(false);
      else onClose();
    };
    document.addEventListener('keydown',onKeyDown);
    return () => document.removeEventListener('keydown',onKeyDown);
  },[isOpen,onClose,confirmClear,isClearing]);
  useEffect(() => { if(confirmClear) clearConfirmRef.current?.focus(); },[confirmClear]);
  useEffect(() => {
    setConfirmClear(false);
    setActionFeedback(null);
    setNotifications([]);
    if (isOpen) setActiveFilter('UNREAD');
    return () => {loadSeqRef.current++;};
  },[isOpen,user?.uid,profile?.uid]);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
      fetchMuteStatus();
    }
  }, [isOpen, activeFilter, user?.uid, profile?.uid]);

  const fetchMuteStatus = async () => {
    if (!user && !profile) return;
    const seq = muteSeqRef.current;
    try {
      const res = await customFetch('/api/settings');
      if (muteSeqRef.current !== seq) return; // stale — a manual toggle happened since
      if (res.ok) {
        const data = await res.json();
        setIsMuted(Boolean(data.muteInAppNotifications ?? data.settings?.muteInAppNotifications));
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  };

  const handleToggleMute = async () => {
    const prevState = isMuted;
    const nextState = !prevState;
    // Invalidate any in-flight mute-status/notification fetches before the
    // optimistic update, so their late responses cannot undo this toggle.
    muteSeqRef.current++;
    setIsMuted(nextState);
    try {
      setIsTogglingMute(true);
      const res = await customFetch('/api/notifications/toggle-mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mute: nextState })
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (typeof data?.muteInAppNotifications === 'boolean') {
          setIsMuted(data.muteInAppNotifications);
        }
      } else {
        setIsMuted(prevState); // Rollback on error
      }
    } catch (err) {
      setIsMuted(prevState); // Rollback on error
      alert("Failed to toggle notification mute state");
    } finally {
      setIsTogglingMute(false);
    }
  };

  const loadNotifications = async (background = false) => {
    if (!user && !profile) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const loadSeq = muteSeqRef.current;
    const requestSeq = ++loadSeqRef.current;
    if (!background) setLoading(true);
    try {
      let url = '/api/notifications?limit=100';
      if (activeFilter === 'WATCHLIST') {
        url += '&watchlistOnly=true';
      } else if (activeFilter === 'RESULTS') {
        url += '&type=RESULTS&watchlistOnly=false';
      } else if (activeFilter === 'ACTIONS') {
        url += '&type=ACTIONS&watchlistOnly=false';
      } else if (activeFilter === 'UNREAD') {
        url += '&unreadOnly=true&watchlistOnly=false';
      } else if (activeFilter === 'ALL') {
        url += '&watchlistOnly=false';
      }

      const res = await customFetch(url);
      if (res.ok) {
        const data = await res.json();
        if (requestSeq !== loadSeqRef.current) return;
        setNotifications(Array.isArray(data.notifications) ? [...data.notifications].sort((a,b) => Number(a.isRead) - Number(b.isRead) || b.timestamp - a.timestamp) : []);
        if (typeof data.muteInAppNotifications === 'boolean' && muteSeqRef.current === loadSeq) {
          setIsMuted(data.muteInAppNotifications);
        }
        onRefreshCount();
      } else if (requestSeq === loadSeqRef.current) {
        setActionFeedback({error:true,message:'Notifications could not be loaded. Please reopen the inbox to retry.'});
      }
    } catch (e) {
      if (requestSeq === loadSeqRef.current) setActionFeedback({error:true,message:'Notifications could not be loaded. Please reopen the inbox to retry.'});
    } finally {
      if (requestSeq === loadSeqRef.current) setLoading(false);
    }
  };

  useVisibilityInterval(() => loadNotifications(true), 15000, isOpen);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (readBusy.current.has(id)) return;
    const account = owner; readBusy.current.add(id); ++loadSeqRef.current; setLoading(false);
    try {
      const res = await customFetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
      if (!res.ok) throw new Error('Read status could not be saved. Please retry.');
      if (ownerRef.current !== account) return;
      setNotifications(prev => filterRef.current === 'UNREAD' ? prev.filter(n => n.id !== id) : prev.map(n => n.id === id ? {...n,isRead:true} : n));
      onRefreshCount();
    } catch {
      if (ownerRef.current === account) setActionFeedback({error:true,message:'Read status could not be saved. Please retry.'});
    } finally { readBusy.current.delete(id); }
  };

  const handleMarkAllRead = async () => {
    if (readBusy.current.has('all')) return;
    const account = owner, ids = new Set(notifications.map(n => n.id));
    readBusy.current.add('all'); ++loadSeqRef.current; setLoading(false);
    try {
      const res = await customFetch('/api/notifications/read-all', { method: 'POST' });
      if (!res.ok) throw new Error('Read status could not be saved.');
      if (ownerRef.current !== account) return;
      setNotifications(prev => filterRef.current === 'UNREAD' ? prev.filter(n => !ids.has(n.id)) : prev.map(n => ids.has(n.id) ? {...n,isRead:true} : n));
      onRefreshCount();
    } catch {
      if (ownerRef.current === account) setActionFeedback({error:true,message:'Read status could not be saved. Please retry.'});
    } finally { readBusy.current.delete('all'); }
  };

  const handleClearAll = async () => {
    if (isClearing) return;
    setIsClearing(true);
    setActionFeedback(null);
    // Ignore older loads that could otherwise resurrect the pre-clear snapshot.
    const clearSeq = ++loadSeqRef.current;
    setLoading(false);
    try {
      const res = await customFetch('/api/notifications', { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.success !== true) throw new Error(data?.error || 'Could not clear your inbox. Please retry.');
      if (clearSeq !== loadSeqRef.current) return;
      setNotifications([]);
      setConfirmClear(false);
      setActionFeedback({error:false,message:'Your inbox is cleared. New notifications will still appear.'});
      onRefreshCount();
    } catch (err) {
      if (clearSeq === loadSeqRef.current) setActionFeedback({error:true,message:err instanceof Error ? err.message : 'Could not clear your inbox. Please retry.'});
    } finally {
      setIsClearing(false);
    }
  };

  const handleNotificationClick = (n: InAppNotificationItem) => {
    if (!n.isRead) {
      handleMarkAsRead(n.id);
    }

    if (n.scripCode || n.symbol) {
      onOpenCompanyIntel(n.scripCode, n.symbol, n.symbol);
      onClose();
    } else if (n.pdfLink) {
      window.open(getSafePdfUrl(n.pdfLink, '', n.newsId, n.scripCode), '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-start justify-center sm:justify-end p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150 overscroll-contain" 
      onClick={() => {if (!isClearing) onClose();}}
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-inbox-title"
    >
      <div 
        className="rich-alert-sheet mobile-alert-sheet bg-white dark:bg-[#1A1926] border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden sm:mt-14 mb-0 animate-in slide-in-from-bottom-4 sm:slide-in-from-right-4 duration-150 overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 bg-slate-50/80 dark:bg-slate-900/60">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Top Header */}
        <div className="mobile-alert-header p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 sm:p-2 rounded-lg text-white shadow-xs",
              isMuted ? "bg-amber-500" : "bg-emerald-500"
            )}>
              {isMuted ? <BellOff size={16} /> : <Bell size={16} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="notification-inbox-title" className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  Notifications
                </h2>
                {unreadCount !== null && unreadCount > 0 && !isMuted && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500">
                {isMuted ? 'Alerts are temporarily muted' : activeFilter === 'WATCHLIST' ? 'Your watchlist filing alerts' : 'Your filing alerts and unread updates'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick Mute/Unmute Toggle */}
            <button
              onClick={handleToggleMute}
              disabled={isTogglingMute}
              aria-label={isMuted ? "Unmute market alerts" : "Mute market alerts"}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                isMuted 
                  ? "bg-amber-500 text-white hover:bg-amber-600 shadow-xs" 
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              )}
              title={isMuted ? "Click to Unmute Bell Alerts" : "Click to Mute Bell Alerts"}
            >
              {isMuted ? <BellOff size={13} /> : <Bell size={13} />}
              <span>{isMuted ? "Muted" : "Mute"}</span>
            </button>

            <button
              onClick={onOpenAlertRules}
              aria-label="Configure Alert Rules & Triggers"
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Configure Alert Rules & Triggers"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={onClose}
              disabled={isClearing}
              aria-label="Close notification inbox"
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close Inbox"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Muted Warning Banner */}
        {isMuted && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-900 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 font-semibold">
            <span className="flex items-center gap-1.5">
              <BellOff size={13} />
              <span>In-App Bell alerts are muted. New notifications will not trigger.</span>
            </span>
            <button 
              onClick={handleToggleMute} 
              className="underline font-bold cursor-pointer hover:opacity-80"
            >
              Unmute
            </button>
          </div>
        )}

        {/* Filter Tabs & Quick Action Bar */}
        <div className="mobile-alert-tabs px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/30 flex flex-col items-stretch gap-2">
          <div className="notification-filter-grid" role="group" aria-label="Filter notifications">
            {[
              { id: 'WATCHLIST' as const, label: 'Watchlist' },
              { id: 'RESULTS' as const, label: 'Results' },
              { id: 'ACTIONS' as const, label: 'Actions' },
              { id: 'UNREAD' as const, label: unreadCount === null ? 'Unread' : `Unread (${unreadCount})` },
              { id: 'ALL' as const, label: 'All' },
            ].map(f => (
              <motion.button
                key={f.id}
                type="button"
                whileTap={buttonTap}
                disabled={isClearing}
                aria-pressed={activeFilter === f.id}
                onClick={() => setActiveFilter(f.id)}
                className={cn(
                  "relative px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap z-10 select-none",
                  activeFilter === f.id
                    ? "text-white"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
                )}
              >
                {activeFilter === f.id && (
                  <motion.div
                    layoutId="notifFilterPill"
                    transition={springSnappy}
                    className="absolute inset-0 bg-slate-900 dark:bg-emerald-600 rounded-md shadow-xs -z-10"
                  />
                )}
                <span>{f.label}</span>
              </motion.button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {unreadCount !== null && unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={isClearing}
                className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Check size={12} />
                <span>Mark all read</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={() => {setActionFeedback(null);setConfirmClear(true);}}
                disabled={isClearing}
                aria-label="Clear All Notifications"
                className="text-[11px] font-bold text-slate-400 hover:text-rose-500 flex items-center gap-0.5 cursor-pointer ml-1 p-1"
                title="Clear All Notifications"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {actionFeedback && <p role={actionFeedback.error ? 'alert' : 'status'} className={cn('px-4 py-2 text-xs',actionFeedback.error ? 'text-rose-600' : 'text-emerald-600')}>{actionFeedback.message}</p>}
        {confirmClear && (
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
            <p className="text-xs text-slate-700 dark:text-slate-200">Clear all existing notifications from your inbox? This affects only your account. New notifications will still appear.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" disabled={isClearing} onClick={() => setConfirmClear(false)} className="px-3 py-2 min-h-[44px] text-xs rounded-lg">Cancel</button>
              <button ref={clearConfirmRef} type="button" disabled={isClearing} onClick={handleClearAll} className="px-3 py-2 min-h-[44px] text-xs rounded-lg bg-rose-600 text-white disabled:opacity-50">{isClearing ? 'Clearing...' : 'Clear my inbox'}</button>
            </div>
          </div>
        )}
        {/* Notification Stream List */}
        <div className="p-2.5 sm:p-3 overflow-y-auto flex-1 space-y-2 pb-16 sm:pb-3">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <Bell size={18} />
              </div>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {activeFilter === 'WATCHLIST' ? 'No Watchlist Alerts' : 'No Notifications'}
              </h4>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                {activeFilter === 'WATCHLIST'
                  ? 'Only real-time BSE filings for stocks currently in your active Watchlist will appear here.'
                  : 'No announcements match this filter right now.'}
              </p>
            </div>
          ) : (
            <motion.div
              key="notif-stream-container"
              variants={containerStaggerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-2"
            >
              <AnimatePresence initial={false}>
                {notifications.map((n, idx) => {
                  const isResult = n.type === 'RESULT' || n.type === 'BOARD_MEETING';
                  const isAction = n.type === 'DIVIDEND' || n.type === 'BONUS' || n.type === 'SPLIT' || n.type === 'BONUS_SPLIT' || n.type === 'BUYBACK';
                  const isOrder = n.type === 'ORDER_WIN';
                  const isHighPriority = n.priority === 'HIGH';

                  return (
                    <motion.div
                      key={n.id || `notif-${idx}`}
                      variants={notificationItemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      layout
                      transition={springStandard}
                      onClick={() => handleNotificationClick(n)}
                      className={cn(
                        "rich-alert-card p-3 rounded-xl border transition-colors cursor-pointer flex items-start gap-3 relative group",
                        !n.isRead && "is-unread"
                      )}
                    >
                    {/* Unread Indicator Bar */}
                    {!n.isRead && (
                      <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-emerald-500 rounded-r" />
                    )}

                    {/* Icon Indicator */}
                    <div className={cn(
                      "p-2 rounded-lg shrink-0 mt-0.5",
                      isHighPriority ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" :
                      isResult ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" :
                      isAction ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" :
                      isOrder ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" :
                      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    )}>
                      {isResult ? <BarChart3 size={15} /> :
                       isAction ? <Coins size={15} /> :
                       isOrder ? <Award size={15} /> : <Zap size={15} />}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2"><span className="notification-read-label">{n.isRead ? 'Read' : 'Unread'}</span><time className="text-[10px] text-slate-500">{formatDateOnly(n.timestamp)} · {formatTimeOnly(n.timestamp)}</time></div>
                      <div className="rich-alert-meta flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {n.isWatchlist && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 shrink-0 flex items-center gap-0.5">
                              <Star size={10} className="fill-amber-500 text-amber-500" />
                              <span>Watchlist</span>
                            </span>
                          )}
                          <span className="rich-alert-title text-xs font-black text-slate-900 dark:text-white">
                            {n.title}
                          </span>
                          {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-label="Unread" />}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {formatTimeOnly(n.timestamp)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>

                      <div className="flex items-center gap-2 pt-1">
                        {n.symbol && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                            {n.symbol}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <span>Stock 360°</span>
                          <ChevronRight size={11} />
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-1 shrink-0 select-none" onClick={e => e.stopPropagation()}>
                      {!n.isRead && (
                        <motion.button
                          type="button"
                          whileTap={buttonTap}
                          transition={springSnappy}
                          onClick={(e) => handleMarkAsRead(n.id, e)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="Mark as read"
                        >
                          <Check size={15} />
                        </motion.button>
                      )}
                      {n.pdfLink && (
                        <motion.a
                          whileTap={buttonTap}
                          transition={springSnappy}
                          href={getSafePdfUrl(n.pdfLink, '', n.newsId, n.scripCode)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="View Official BSE PDF"
                        >
                          <ExternalLink size={14} />
                        </motion.a>
                      )}
                    </div>
                  </motion.div>
                );
              })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between text-xs">
          <button
            onClick={onOpenAlertRules}
            className="text-slate-600 dark:text-slate-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Settings size={13} />
            <span>Alert Rules &amp; Triggers</span>
          </button>

          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-lg text-xs hover:opacity-90 transition-opacity cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
