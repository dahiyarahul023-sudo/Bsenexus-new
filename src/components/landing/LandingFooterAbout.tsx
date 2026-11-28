import React, { useState } from 'react';
import {
  ShieldCheck,
  HelpCircle,
  ChevronDown,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import { BseNexusLogo } from '../ui/BseNexusLogo';
import { AiIntelligenceLogo } from '../ui/AiIntelligenceLogo';
import { CompanyLogo, GoogleGLogo, type CompanySymbol } from './CompanyLogos';
import { triggerTapHaptic } from '../../utils/haptics';
import { APP_VERSION_LABEL } from '../../version';

interface LandingFooterAboutProps {
  onEnterTerminal: (tab?: string) => void;
}

interface FaqItem {
  q: string;
  a: string;
  tag: string;
}

const FAQS: FaqItem[] = [
  {
    tag: 'Live Feed',
    q: 'How does BSE Nexus track corporate announcements and results?',
    a: 'BSE Nexus connects directly to official exchange regulatory repositories. Announcements, board outcomes, and PDF disclosures are indexed by exact scrip code so you can read the source filing immediately.',
  },
  {
    tag: 'Cross-Device',
    q: 'Does it work smoothly on both mobile phones and desktops?',
    a: 'Yes. BSE Nexus is designed mobile-first for quick phone reading on the go and expands into a multi-column research terminal on tablets and desktops, with optional Telegram alerts.',
  },
  {
    tag: 'AI Extraction',
    q: 'How do the AI Earnings and PDF summaries work?',
    a: 'When a financial result or material filing is published, our pipeline extracts key figures (Revenue, PAT, EBITDA, Margins, Order Book) and condenses long PDFs into a source-linked executive summary.',
  },
  {
    tag: 'Watchlists',
    q: 'Can I track only specific companies in my portfolio?',
    a: 'Yes. You can build custom watchlists and filter both the Results Calendar and Telegram notifications strictly to your tracked companies.',
  },
  {
    tag: 'Compliance',
    q: 'Is BSE Nexus a SEBI-registered advisory service?',
    a: 'No. BSE Nexus is an exchange disclosure and financial research platform. We do not provide stock tips, price targets, buy/sell calls, or investment advice.',
  },
];

const ABOUT_SHOWCASE_LOGOS: CompanySymbol[] = [
  'BSE',
  'NSE',
  'RELIANCE',
  'TCS',
  'HDFCBANK',
  'INFY',
  'ICICIBANK',
  'SBIN',
];

export function LandingFooterAbout({ onEnterTerminal }: LandingFooterAboutProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    triggerTapHaptic();
    setOpenFaq(prev => (prev === idx ? null : idx));
  };

  return (
    <footer className="relative z-10 bg-slate-100/80 dark:bg-slate-950/90 border-t border-slate-200/90 dark:border-slate-800/90 pt-8 sm:pt-14 pb-8 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
        {/* ================= FREQUENTLY ASKED QUESTIONS ================= */}
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-5 sm:mb-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 shadow-2xs">
              <HelpCircle className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              <span>Questions &amp; Clarity</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight font-display">
              Frequently Asked Questions
            </h3>
          </div>

          <div className="space-y-2">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-2xl bg-white/95 dark:bg-slate-900/80 border overflow-hidden transition-all duration-200 ${
                    isOpen
                      ? 'border-emerald-500/40 dark:border-emerald-400/40 shadow-sm'
                      : 'border-slate-200/85 dark:border-slate-800/85'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full px-3.5 py-3 sm:px-4 sm:py-3.5 text-left flex items-center justify-between gap-2.5 font-bold text-slate-900 dark:text-white text-[13.5px] sm:text-sm hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shrink-0">
                        {faq.tag}
                      </span>
                      <span className="leading-snug">{faq.q}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                        isOpen ? 'rotate-180 text-emerald-500' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal border-t border-slate-100 dark:border-slate-800/60 pt-2.5">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= AUTHORITATIVE ABOUT SECTION WITH BRAND LOGOS ================= */}
        <section
          id="about"
          aria-labelledby="about-bsenexus-heading"
          className="max-w-4xl mx-auto p-4 sm:p-7 rounded-3xl bg-white/95 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4 sm:space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-3.5 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-3">
              <BseNexusLogo size="lg" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3
                    id="about-bsenexus-heading"
                    className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight font-display"
                  >
                    About Bsenexus
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[10px] font-mono font-bold uppercase">
                    <AiIntelligenceLogo size={11} className="text-emerald-500" />
                    <span>Verified Terminal</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Indian Corporate Filings, Earnings Calendar &amp; Equity Intelligence
                </p>
              </div>
            </div>

            {/* Official Exchange & Issuer Brand Strip */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {ABOUT_SHOWCASE_LOGOS.map(symbol => (
                <CompanyLogo
                  key={symbol}
                  symbol={symbol}
                  size={28}
                  className="rounded-lg p-1"
                />
              ))}
            </div>
          </div>

          <div className="space-y-2.5 text-[13px] sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              BSE Nexus brings public exchange disclosures, company watchlists and source documents into one research workspace for Indian market participants.
            </p>
            <p>
              Exchange monitoring, personal Telegram alerts and supported AI document extraction help you follow disclosures. Delivery and analysis times vary with upstream availability.
            </p>
          </div>

          {/* Mobile-Friendly 3-Pillar Summary Chips */}
          <div className="grid grid-cols-1 min-[460px]:grid-cols-3 gap-2 sm:gap-2.5 pt-0.5">
            <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800/80">
              <CompanyLogo symbol="BSE" size={26} className="rounded-lg p-1" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  Direct Exchange PDFs
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Scrip-verified filings
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800/80">
              <span className="w-6.5 h-6.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0">
                <GoogleGLogo size={14} />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  Google Sign-In &amp; AI
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Structured Reg 33 tables
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800/80">
              <CompanyLogo symbol="RELIANCE" size={26} className="rounded-lg p-1" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  210+ F&amp;O &amp; Watchlists
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Earnings &amp; board dates
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Independent Financial Technology Platform</span>
            </span>
            <button
              type="button"
              onPointerDown={triggerTapHaptic}
              onClick={() => onEnterTerminal('dashboard')}
              className="self-start sm:self-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition-all cursor-pointer active:scale-95"
            >
              <span>Launch Live Terminal</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>

        {/* ================= REGULATORY SEBI DISCLAIMER ================= */}
        <div className="max-w-4xl mx-auto text-center space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed px-2">
          <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Regulatory Notice &amp; Compliance Statement</span>
          </p>
          <p>
            BSE Nexus is an independent market data aggregation tool and is NOT registered with SEBI as an Investment Adviser or Research Analyst. All corporate filings, quarterly metrics, and summaries are sourced from official exchange disclosures solely for informational and research purposes.
          </p>
        </div>

        {/* ================= FINAL FOOTER BAR ================= */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2.5">
            <BseNexusLogo size="sm" />
            <span className="font-medium text-slate-700 dark:text-slate-300">
              © {new Date().getFullYear()} BSE Nexus. All rights reserved.
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 font-semibold text-slate-600 dark:text-slate-400">
            <a
              href="/plugin"
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              AI Plugin &amp; API
            </a>
            <button
              type="button"
              onClick={() => onEnterTerminal('dashboard')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Live Terminal
            </button>
            <button
              type="button"
              onClick={() => onEnterTerminal('results-calendar')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Results Calendar
            </button>
          </div>
        </div>
        <p className="mt-4 text-center text-[11px] text-slate-600 dark:text-slate-400">{APP_VERSION_LABEL}</p>
      </div>
    </footer>
  );
}
