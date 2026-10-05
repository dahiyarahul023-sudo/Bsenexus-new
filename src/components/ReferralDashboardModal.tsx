import React, { useState, useEffect } from 'react';
import { getPlanDisplay } from '../config/plans';
import {
  X,
  Copy,
  Check,
  Share2,
  Sparkles,
  Users,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  Send,
  MessageCircle,
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
  status: string;
}

interface ReferralDashboardData {
  code: string;
  referralLink: string;
  type: 'creator' | 'user';
  commissionPercent: number;
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
  const [data, setData] = useState<ReferralDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [customCodeLoading, setCustomCodeLoading] = useState(false);
  const [customCodeMsg, setCustomCodeMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'how_it_works'>('overview');

  const fetchReferralData = async () => {
    if (!user || user.isAnonymous) return;
    setLoading(true);
    setError(null);
    try {
      const res = await customFetch('/api/referrals/my-code');
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json);
        setCustomCodeInput(json.code);
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
      fetchReferralData();
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!data?.referralLink) return;
    navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  const monthlyPlan = getPlanDisplay('pro_monthly');
  const shareText = `Get Flat ₹${monthlyPlan.referralDiscount} OFF on BSE Nexus Pro Monthly (Pay only ₹${monthlyPlan.referralPrice} instead of ₹${monthlyPlan.price}) with my partner link: ${data?.referralLink || ''}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(data?.referralLink || '')}&text=${encodeURIComponent(`Get Flat ₹${monthlyPlan.referralDiscount} OFF on BSE Nexus Pro Monthly (Pay ₹${monthlyPlan.referralPrice} instead of ₹${monthlyPlan.price})!`)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-white dark:bg-[#14131B] text-slate-900 dark:text-slate-100 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Refer &amp; Earn Partner Program</h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  {data?.type === 'creator' ? 'Creator Partner' : 'Community Referral'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Give ₹100 Flat Discount to your audience · Earn {data?.commissionPercent || 25}% commission on every conversion
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-6 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500">
          <button
            className={`py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            Overview &amp; Share
          </button>
          <button
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            onClick={() => setActiveTab('audit')}
          >
            Verified Referrals Audit
            {data && data.stats.totalConversions > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500 text-white">
                {data.stats.totalConversions}
              </span>
            )}
          </button>
          <button
            className={`py-3 px-3 border-b-2 transition-colors ${
              activeTab === 'how_it_works'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            onClick={() => setActiveTab('how_it_works')}
          >
            Commission &amp; Rules
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-16 text-center text-slate-400">Loading your referral details…</div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-sm">
              {error}
            </div>
          ) : data ? (
            <>
              {activeTab === 'overview' && (
                <>
                  {/* Share Link Banner */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20">
                    <p className="text-xs uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                      Your Unique Referral Link
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="text"
                        readOnly
                        value={data.referralLink}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono select-all focus:outline-none"
                      />
                      <button
                        onClick={handleCopy}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>

                    {/* Quick Social Shares */}
                    <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-emerald-500/10">
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
                        <Share2 size={14} /> Twitter / X
                      </a>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                      <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                        <TrendingUp size={13} /> Link Clicks
                      </span>
                      <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                        {data.stats.totalClicks}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                      <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                        <Users size={13} /> Pro Conversions
                      </span>
                      <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                        {data.stats.totalConversions}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                      <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                        <DollarSign size={13} /> Total Commission
                      </span>
                      <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                        ₹{data.stats.totalEarningsRupees.toLocaleString('en-IN')}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                      <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                        <ShieldCheck size={13} /> Pending Payout
                      </span>
                      <p className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                        ₹{data.stats.pendingPayoutRupees.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>

                  {/* Custom Vanity Code Section (For Creators) */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Customize Your Referral Code
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Choose a memorable vanity code for your social media bio, YouTube videos, or Telegram channel.
                    </p>
                    <form onSubmit={handleCustomCodeSubmit} className="flex gap-2 mt-3 max-w-md">
                      <input
                        type="text"
                        value={customCodeInput}
                        onChange={(e) => setCustomCodeInput(e.target.value.toUpperCase())}
                        placeholder="e.g. AKSHAT or FINANCEPRO"
                        maxLength={20}
                        className="flex-1 px-3 py-2 text-xs font-mono uppercase rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-inherit focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={customCodeLoading || customCodeInput.trim() === data.code}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-40 transition-opacity"
                      >
                        {customCodeLoading ? 'Saving…' : 'Update Code'}
                      </button>
                    </form>
                    {customCodeMsg && (
                      <p
                        className={`text-xs mt-2 ${
                          customCodeMsg.ok
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {customCodeMsg.text}
                      </p>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'audit' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold">100% Verifiable Referrals Audit Ledger</h3>
                      <p className="text-xs text-slate-500">
                        Complete transparent proof of every account that upgraded using your referral code.
                      </p>
                    </div>
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/20">
                      Zero-Dispute Guarantee
                    </span>
                  </div>

                  {data.conversions.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800">
                      <Users size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        No conversions yet
                      </p>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                        Share your referral link on YouTube, WhatsApp, or Telegram. As soon as someone signs up and subscribes, their verified transaction will appear here in real-time.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                            <tr>
                              <th className="py-3 px-4 font-semibold">Date &amp; Time</th>
                              <th className="py-3 px-4 font-semibold">Account</th>
                              <th className="py-3 px-4 font-semibold">Plan</th>
                              <th className="py-3 px-4 font-semibold">Order Reference</th>
                              <th className="py-3 px-4 font-semibold">User Paid</th>
                              <th className="py-3 px-4 font-semibold text-right">Your Commission</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {data.conversions.map((conv) => (
                              <tr key={conv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                  {new Date(conv.convertedAt).toLocaleString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true,
                                  })}
                                </td>
                                <td className="py-3 px-4 font-medium">{conv.referredEmailMasked}</td>
                                <td className="py-3 px-4 whitespace-nowrap">{conv.planLabel}</td>
                                <td className="py-3 px-4 font-mono text-[10px] text-slate-400 whitespace-nowrap select-all">
                                  {conv.orderId}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  ₹{conv.finalAmount}{' '}
                                  <span className="text-[10px] text-emerald-600 font-medium">
                                    (-₹{conv.discountAmount} off)
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400 text-right whitespace-nowrap">
                                  +₹{conv.commission}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'how_it_works' && (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm">
                        1
                      </div>
                      <h4 className="text-sm font-bold mt-2">Share Your Link</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Share your partner link or custom code with your audience or friends.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm">
                        2
                      </div>
                      <h4 className="text-sm font-bold mt-2">Flat ₹{monthlyPlan.referralDiscount} Discount</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Anyone clicking your link gets a flat ₹{monthlyPlan.referralDiscount} discount on Monthly (₹{monthlyPlan.referralPrice} instead of ₹{monthlyPlan.price}), plus discounts on all plans.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm">
                        3
                      </div>
                      <h4 className="text-sm font-bold mt-2">Earn Commission</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        You earn {data.commissionPercent}% commission on every conversion, verified on our ledger and paid out via UPI or Bank Transfer.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 space-y-2">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      Payout &amp; Integrity Guidelines:
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Self-referral is strictly blocked to maintain fairness for all creators.</li>
                      <li>Payouts are processed weekly directly to your Indian UPI ID or Bank account.</li>
                      <li>
                        For custom creator partnership arrangements or high-volume sponsorship inquiries, contact support at <strong>support@bsenexus.in</strong>.
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>BSE Nexus Partner &amp; Affiliate Network</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
