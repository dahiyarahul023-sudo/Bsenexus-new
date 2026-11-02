import React, { useState } from 'react';
import { 
  Building2, ShieldCheck, HelpCircle, ChevronDown, 
  ExternalLink, ArrowUpRight, Heart, Sparkles, Send
} from 'lucide-react';
import { BseNexusLogo } from '../ui/BseNexusLogo';
import { SocialIconsRow } from '../ui/SocialLinks';

interface LandingFooterAboutProps {
  onEnterTerminal: (tab?: string) => void;
}

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: 'How fast is BSE Nexus compared to traditional broker news terminals?',
    a: 'BSE Nexus connects directly to the BSE India regulatory feed infrastructure. Announcements are parsed and dispatched to Telegram in under 1 second, often beating terminal feeds by 15 to 45 seconds.'
  },
  {
    q: 'Do I need to install any heavy software or browser extensions?',
    a: 'No. BSE Nexus is a high-performance progressive web app that runs on any modern browser across iOS, Android, macOS, and Windows. You can also receive alerts directly on Telegram without opening the app.'
  },
  {
    q: 'How do the AI Earnings and PDF summaries work?',
    a: 'When an unaudited financial result or material filing is uploaded to the exchange, our server pipeline extracts key metrics (Revenue, PAT, EBITDA, Margins, Debt) and condenses 50+ page PDFs into a structured 5-bullet executive summary.'
  },
  {
    q: 'Can I track only specific stocks on my personal watchlist?',
    a: 'Yes. You can create multiple custom watchlists and configure your Telegram notifications to trigger strictly for your tracked symbols, eliminating noise from thousands of daily filings.'
  },
  {
    q: 'Is BSE Nexus a SEBI-registered advisory service?',
    a: 'No. BSE Nexus is purely an exchange data aggregation and regulatory disclosure intelligence tool. We do not provide stock recommendations, price targets, buy/sell calls, or financial advice.'
  }
];

export function LandingFooterAbout({ onEnterTerminal }: LandingFooterAboutProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenFaq(prev => prev === idx ? null : idx);
  };

  return (
    <footer className="relative bg-slate-100/70 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-20 pb-12 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        
        {/* ================= FREQUENTLY ASKED QUESTIONS ================= */}
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/60 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3">
              <HelpCircle className="w-3.5 h-3.5 text-sky-500" />
              <span>Questions &amp; Clarity</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Frequently Asked Questions
            </h3>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div 
                  key={idx}
                  className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 overflow-hidden transition-all duration-200"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-slate-900 dark:text-white text-sm sm:text-base hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                    aria-expanded={isOpen}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal border-t border-slate-100 dark:border-slate-800/40 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= CLEAN AUTHORITATIVE ABOUT SECTION ================= */}
        <section id="about" aria-labelledby="about-bsenexus-heading" className="max-w-4xl mx-auto p-8 sm:p-10 rounded-3xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id="about-bsenexus-heading" className="text-lg font-bold text-slate-900 dark:text-white">About Bsenexus</h3>
              <p className="text-xs text-slate-500">Autonomous Financial Intelligence Infrastructure</p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
            BSE Nexus was built to solve a critical asymmetry in Indian capital markets: while institutional hedge funds 
            and algorithmic desks receive corporate disclosures in sub-second pipes, retail investors and independent research analysts 
            often discover major catalysts minutes or hours late through delayed social feeds and broker terminals.
          </p>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
            By combining high-frequency exchange monitoring, instant Telegram push architecture, and automated Generative AI 
            financial document extraction, BSE Nexus provides institutional-grade filing speed and transparency to every market participant.
          </p>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Independent Financial Technology Platform</span>
            </span>
            <div className="flex items-center gap-3 font-semibold text-slate-700 dark:text-slate-300">
              <button onClick={() => onEnterTerminal('dashboard')} className="hover:text-sky-500 transition-colors">
                Launch Live Terminal →
              </button>
            </div>
          </div>
        </section>

        {/* ================= REGULATORY SEBI DISCLAIMER ================= */}
        <div className="max-w-4xl mx-auto text-center space-y-2 text-[11px] text-slate-500 dark:text-slate-500 leading-relaxed px-4">
          <p className="font-semibold text-slate-600 dark:text-slate-400">
            Regulatory Notice &amp; Compliance Statement
          </p>
          <p>
            BSE Nexus is an independent market data aggregation tool and is NOT registered with the Securities and Exchange Board of India (SEBI) as an Investment Adviser or Research Analyst. 
            All data, corporate filings, quarterly metrics, and AI-generated summaries presented on this platform are sourced publicly from official exchange repositories and are provided solely for educational and informational purposes. 
            No content constitutes financial advice, stock recommendations, or an offer to buy or sell securities.
          </p>
        </div>

        {/* ================= FINAL FOOTER BAR ================= */}
        <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <BseNexusLogo size="sm" />
            <span>© {new Date().getFullYear()} BSE Nexus. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6 font-medium">
            <a href="/plugin" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              AI Plugin &amp; API
            </a>
            <button onClick={() => onEnterTerminal('dashboard')} className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Live Terminal
            </button>
            <button onClick={() => onEnterTerminal('results-calendar')} className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Results Calendar
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
}
