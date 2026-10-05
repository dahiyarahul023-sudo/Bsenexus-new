import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePaymentDialog } from '../hooks/usePaymentDialog';
import '../styles/referral.css';
import {
  X,
  Copy,
  Check,
  Share2,
  Sparkles,
  Users,
  Award,
  TrendingUp,
  ShieldCheck,
  ExternalLink,
  MessageCircle,
  Gift,
  BadgePercent,
  Wallet,
  ArrowRight,
  Send,
} from 'lucide-react';
import { customFetch } from '../api';
import { useAuth } from '../context/AuthContext';

interface ReferralConversionItem {
  id: string;
  orderId: string;
  planLabel: string;
  convertedAt: number;
  referredEmailMasked: string;
  finalAmount: number;
  discountAmount: number;
  commission: number;
  rewardType: 'free_pro_days' | 'cash_commission';
  freeProDaysGranted?: number;
  status: string;
}

interface ReferralDashboardData {
  code: string;
  referralLink: string;
  type: 'creator' | 'user';
  commissionPercent: number;
  tierInfo: {
    tierName: string;
    commissionPercent: number;
    nextTierName?: string;
    conversionsToNext?: number;
  };
  freeProDaysPerReferral: number;
  totalFreeDaysEarned: number;
  payoutUpiId?: string;
  payoutBankInfo?: string;
  stats: {
    totalClicks: number;
    totalSignups: number;
    totalConversions: number;
    totalEarningsRupees: number;
    pendingPayoutRupees: number;
    paidPayoutRupees: number;
  };
  conversions: ReferralConversionItem[];
  benefits: {
    monthlyDiscount: number;
    weeklyDiscount: number;
    halfyearlyDiscount: number;
    yearlyDiscount: number;
    freeProReward: string;
    commissionRate: string;
  };
}

export function ReferralDashboardModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const dialog = usePaymentDialog(isOpen, onClose);
  const contentRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<ReferralDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [customCodeLoading, setCustomCodeLoading] = useState(false);
  const [customCodeMsg, setCustomCodeMsg] = useState<{ text: string; ok: boolean } | null>(null);
  
  // Tab: 'friends' (Free Pro Days), 'creator' (Tiered Cash Commission), 'audit' (Verified Ledger)
  const [activeTab, setActiveTab] = useState<'friends' | 'creator' | 'audit'>('friends');

  // Payout form state for creators
  const [upiInput, setUpiInput] = useState('');
  const [bankInfoInput, setBankInfoInput] = useState('');
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState<string | null>(null);

  const selectTab = (tab: 'friends' | 'creator' | 'audit') => {
    setActiveTab(tab);
    contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };

  const fetchReferralData = async (initial = false) => {
    if (!user || user.isAnonymous) return;
    setLoading(true);
    setError(null);
    try {
      const res = await customFetch('/api/referrals/my-code');
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json);
        setCustomCodeInput(json.code);
        setUpiInput(json.payoutUpiId || '');
        setBankInfoInput(json.payoutBankInfo || '');
        if (initial && json.type === 'creator') {
          setActiveTab('creator');
        }
      } else {
        setError(json?.error || 'Could not load referral dashboard');
      }
    } catch {
      setError('Network connection error while loading referral stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user && !user.isAnonymous) {
      fetchReferralData(true);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  // Always enforce canonical https://bsenexus.in/?ref=CODE
  const cleanCode = data?.code || '';
  const canonicalLink = `https://bsenexus.in/?ref=${encodeURIComponent(cleanCode)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(canonicalLink);
      setCopyError('');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('Could not copy. Select the link above and copy it manually.');
    }
  };

  const handleCustomCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customCodeInput.trim().toUpperCase();
    if (!clean || clean === data?.code) return;
    setCustomCodeLoading(true);
    setCustomCodeMsg(null);
    try {
      const res = await customFetch('/api/referrals/custom-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: clean }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setCustomCodeMsg({ text: 'Referral code updated successfully!', ok: true });
        fetchReferralData();
      } else {
        setCustomCodeMsg({ text: json?.error || 'Could not update code', ok: false });
      }
    } catch {
      setCustomCodeMsg({ text: 'Error connecting to server', ok: false });
    } finally {
      setCustomCodeLoading(false);
    }
  };

  const handleSavePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upiInput.trim() && !bankInfoInput.trim()) return;
    setPayoutSaving(true);
    setPayoutMsg(null);
    try {
      const res = await customFetch('/api/referrals/payout-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upiId: upiInput.trim(), bankInfo: bankInfoInput.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setPayoutMsg('Payout details saved successfully!');
      } else {
        setPayoutMsg(json?.error || 'Failed to save payout info');
      }
    } catch {
      setPayoutMsg('Network error saving payout info');
    } finally {
      setPayoutSaving(false);
    }
  };

  const handleSwitchToCreator = async () => {
    try {
      const res = await customFetch('/api/referrals/set-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'creator' }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        fetchReferralData();
        setActiveTab('creator');
      }
    } catch {
      // ignore
    }
  };

  const referralDiscount = data?.benefits?.monthlyDiscount ?? 0;
  const shareText = `Get Flat ₹${referralDiscount} OFF on BSE Nexus Pro Monthly with my referral link: ${canonicalLink}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(canonicalLink)}&text=${encodeURIComponent(`Get Flat ₹${referralDiscount} OFF on BSE Nexus Pro Monthly!`)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  const totalConversions = data?.stats.totalConversions || 0;
  const freeDaysEarned = data?.totalFreeDaysEarned ?? totalConversions * 14;

  return createPortal(
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="referral-title"
      className="referral-overlay" 
      onClick={onClose}
    >
      <div
        className="referral-sheet bg-white dark:bg-[#14131B] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="referral-handle" aria-hidden="true" />
        {/* Header */}
        <div className="referral-header flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 id="referral-title" className="text-base sm:text-lg font-bold">Refer &amp; Earn Rewards</h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  {data?.type === 'creator' ? 'Creator Partner' : 'Community Member'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Share Pro with friends · Track your rewards and creator payouts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close referral dashboard"
            className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="referral-tabs" role="tablist" aria-label="Referral rewards">
          {([
            { id: 'friends', title: 'Invite Friends', subtitle: 'Free Pro', Icon: Gift },
            { id: 'creator', title: 'Creator', subtitle: 'Affiliate & payouts', Icon: BadgePercent },
            { id: 'audit', title: 'Verified', subtitle: 'Referral ledger', Icon: ShieldCheck },
          ] as const).map(({ id, title, subtitle, Icon }, index) => (
            <button key={id} type="button" role="tab" id={`referral-tab-${id}`}
              aria-selected={activeTab === id} aria-controls="referral-panel"
              tabIndex={activeTab === id ? 0 : -1}
              className="referral-tab"
              onClick={() => selectTab(id)}
              onKeyDown={event => {
                const ids = ['friends', 'creator', 'audit'] as const;
                const next = event.key === 'ArrowRight' ? (index + 1) % 3
                  : event.key === 'ArrowLeft' ? (index + 2) % 3
                  : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1;
                if (next < 0) return;
                event.preventDefault();
                selectTab(ids[next]);
                document.getElementById(`referral-tab-${ids[next]}`)?.focus();
              }}>
              <span className="referral-tab-title"><Icon size={16} /><span>{title}</span></span>
              <span className="referral-tab-subtitle">{subtitle}</span>
            </button>
          ))}
        </div>

        {/* Content Body with isolated vertical scroll */}
        <div ref={contentRef} id="referral-panel" role="tabpanel" tabIndex={0}
          aria-labelledby={`referral-tab-${activeTab}`}
          className="referral-content p-4 sm:p-6 space-y-6">
          {loading ? (
            <div className="py-16 text-center text-slate-400">Loading your referral details…</div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-sm">
              <p role="alert">{error}</p>
              <button type="button" onClick={() => fetchReferralData()} className="mt-3 px-4 py-2 rounded-xl border border-current font-semibold">Try again</button>
            </div>
          ) : data ? (
            <>
              {/* Universal Share Link Box */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                  <p className="text-xs uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                    Your Official Referral Link
                  </p>
                  <span className="text-[11px] text-slate-400">
                    Gives ₹{referralDiscount} Flat Discount on Pro Monthly
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    aria-label="Your referral link"
                    value={canonicalLink}
                    className="min-w-0 flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-mono select-all focus:outline-none"
                  />
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-sm shrink-0 cursor-pointer"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {copyError && <p role="status" className="text-xs text-rose-600 mt-2">{copyError}</p>}
                {/* Quick Social Shares */}
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-emerald-500/10">
                  <span className="text-xs text-slate-500 font-medium">Quick share:</span>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 text-xs font-medium"
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-400 text-xs font-medium"
                  >
                    <Send size={14} /> Telegram
                  </a>
                  <a
                    href={twitterUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 text-slate-700 dark:text-slate-300 text-xs font-medium"
                  >
                    <Share2 size={14} /> X / Twitter
                  </a>
                </div>
              </div>

              {/* TAB 1: FRIENDS & FREE PRO DAYS */}
              {activeTab === 'friends' && (
                <div className="space-y-6">
                  {/* Community Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                      <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                        <span>Free Pro Earned</span>
                        <Award size={16} className="text-amber-500" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        +{freeDaysEarned} Days
                      </div>
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                        +14 days per friend
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                      <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                        <span>Friends Joined</span>
                        <Users size={16} className="text-emerald-500" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        {totalConversions}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {data.stats.totalClicks} link clicks
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 col-span-2 sm:col-span-1">
                      <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                        <span>Friend's Discount</span>
                        <BadgePercent size={16} className="text-indigo-500" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        Flat ₹{referralDiscount}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        On Pro Monthly with your link
                      </div>
                    </div>
                  </div>

                  {/* How Friend Referral Works */}
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Gift size={16} className="text-emerald-500" />
                      How Community Referrals Work
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
                        <div className="font-bold text-emerald-600">1. Share Your Link</div>
                        <p className="text-slate-500">Share your clean link or code with your investor friends.</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
                        <div className="font-bold text-emerald-600">2. Friend Saves ₹{referralDiscount}</div>
                        <p className="text-slate-500">They get Flat ₹{referralDiscount} OFF on Pro Monthly with your link.</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
                        <div className="font-bold text-emerald-600">3. You Get +14 Days Pro</div>
                        <p className="text-slate-500">Your account automatically receives +14 Days of BSE Nexus Pro free!</p>
                      </div>
                    </div>
                  </div>

                  {/* Creator Tier Upgrade Callout */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Are you a Content Creator or Influencer?</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Switch to our Creator Affiliate tier to earn up to 30% tiered cash commissions with direct UPI/Bank payouts.
                      </p>
                    </div>
                    <button
                      onClick={() => selectTab('creator')}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shrink-0 cursor-pointer transition-colors"
                    >
                      View Creator Tier
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: CREATOR AFFILIATE & TIERED COMMISSIONS */}
              {activeTab === 'creator' && (
                <div className="space-y-6">
                  {/* Tier Progress Bar */}
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-emerald-500/5 to-transparent border border-indigo-500/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
                          Current Commission Tier
                        </span>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                          {data.tierInfo.tierName}
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                          {data.tierInfo.commissionPercent}%
                        </span>
                        <div className="text-[11px] text-slate-400">Per Conversion</div>
                      </div>
                    </div>

                    {data.tierInfo.nextTierName && (
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Progress to {data.tierInfo.nextTierName}</span>
                          <span className="font-semibold text-emerald-600">
                            {data.tierInfo.conversionsToNext} more referral{data.tierInfo.conversionsToNext === 1 ? '' : 's'} needed
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-600 transition-all duration-500"
                            style={{
                              width: `${Math.min(100, Math.max(10, (totalConversions / ((totalConversions + (data.tierInfo.conversionsToNext || 1)))) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Creator Financial Stats */}
                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                      <div className="text-slate-500 text-xs font-medium">Total Earned</div>
                      <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        ₹{data.stats.totalEarningsRupees}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{totalConversions} conversions</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                      <div className="text-slate-500 text-xs font-medium">Pending Payout</div>
                      <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                        ₹{data.stats.pendingPayoutRupees}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Verified ledger</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                      <div className="text-slate-500 text-xs font-medium">Paid Out</div>
                      <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                        ₹{data.stats.paidPayoutRupees}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">UPI / Bank</div>
                    </div>
                  </div>

                  {/* Volume Tiers Breakdown */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Tiered Commission Milestones (जितने ज्यादा रेफरल, उतना ज्यादा कमीशन)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className={`p-3 rounded-xl border ${totalConversions < 5 ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'}`}>
                        <div className="font-bold">Bronze Starter</div>
                        <div className="text-emerald-600 font-bold mt-1">15% Commission</div>
                        <div className="text-[11px] text-slate-400">1 to 4 Referrals</div>
                      </div>
                      <div className={`p-3 rounded-xl border ${totalConversions >= 5 && totalConversions < 20 ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'}`}>
                        <div className="font-bold">Silver Creator</div>
                        <div className="text-emerald-600 font-bold mt-1">20% Commission</div>
                        <div className="text-[11px] text-slate-400">5 to 19 Referrals</div>
                      </div>
                      <div className={`p-3 rounded-xl border ${totalConversions >= 20 && totalConversions < 50 ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'}`}>
                        <div className="font-bold">Gold Partner</div>
                        <div className="text-emerald-600 font-bold mt-1">25% Commission</div>
                        <div className="text-[11px] text-slate-400">20 to 49 Referrals</div>
                      </div>
                      <div className={`p-3 rounded-xl border ${totalConversions >= 50 ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'}`}>
                        <div className="font-bold">Platinum Elite</div>
                        <div className="text-emerald-600 font-bold mt-1">30% Commission</div>
                        <div className="text-[11px] text-slate-400">50+ Referrals</div>
                      </div>
                    </div>
                  </div>

                  {/* Payout Details Form */}
                  <form onSubmit={handleSavePayout} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center gap-2">
                      <Wallet size={16} className="text-emerald-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Payout Preferences (UPI / Bank Transfer)
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="referral-upi" className="block text-[11px] text-slate-500 mb-1">UPI ID (e.g. yourname@okaxis)</label>
                        <input
                          type="text"
                          id="referral-upi" placeholder="username@upi"
                          value={upiInput}
                          onChange={(e) => setUpiInput(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="referral-bank" className="block text-[11px] text-slate-500 mb-1">Bank Account &amp; IFSC (Optional)</label>
                        <input
                          type="text"
                          id="referral-bank" placeholder="A/C No, IFSC, Beneficiary Name"
                          value={bankInfoInput}
                          onChange={(e) => setBankInfoInput(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {payoutMsg && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        {payoutMsg}
                      </p>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={payoutSaving}
                        className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        {payoutSaving ? 'Saving…' : 'Save Payout Details'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 3: VERIFIED AUDIT LEDGER */}
              {activeTab === 'audit' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Audit-Proof Referral Ledger</h4>
                      <p className="text-xs text-slate-500">Every upgraded user with order reference &amp; credited reward.</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                      {data.conversions.length} Verified Entries
                    </span>
                  </div>

                  {data.conversions.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-500">
                      No conversions recorded yet. When a friend or subscriber uses your link to upgrade, their entry will appear here automatically with zero discrepancy.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full min-w-[640px] text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-semibold">User</th>
                            <th className="px-4 py-3 font-semibold">Plan</th>
                            <th className="px-4 py-3 font-semibold">Date</th>
                            <th className="px-4 py-3 font-semibold">Paid Amount</th>
                            <th className="px-4 py-3 font-semibold">Reward Credited</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {data.conversions.map((conv) => (
                            <tr key={conv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                              <td className="px-4 py-3 font-mono font-medium">{conv.referredEmailMasked}</td>
                              <td className="px-4 py-3">{conv.planLabel}</td>
                              <td className="px-4 py-3 text-slate-500">
                                {new Date(conv.convertedAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </td>
                              <td className="px-4 py-3 font-medium">₹{conv.finalAmount}</td>
                              <td className="px-4 py-3 font-semibold text-emerald-600">
                                {conv.rewardType === 'cash_commission'
                                  ? `₹${conv.commission} Cash`
                                  : `+${conv.freeProDaysGranted || 14} Days Pro`}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                  <Check size={10} /> Confirmed
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Custom Referral Code Form (Collapsible/Clean) */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <form onSubmit={handleCustomCodeSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    Customize Your Code:
                  </div>
                  <input
                    type="text"
                    value={customCodeInput}
                    onChange={(e) => setCustomCodeInput(e.target.value.toUpperCase())}
                    aria-label="Custom referral code" placeholder="Enter custom alias"
                    maxLength={16}
                    className="min-w-0 flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={customCodeLoading || customCodeInput.trim().toUpperCase() === data.code}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {customCodeLoading ? 'Saving…' : 'Update Code'}
                  </button>
                </form>

                {customCodeMsg && (
                  <p className={`text-xs mt-1.5 ${customCodeMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                    {customCodeMsg.text}
                  </p>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
export default ReferralDashboardModal;

