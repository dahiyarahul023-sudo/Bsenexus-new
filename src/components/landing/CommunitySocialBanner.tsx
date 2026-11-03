import React from 'react';
import { Users, ArrowUpRight, CheckCircle2, MessageSquare, Sparkles } from 'lucide-react';

interface SocialPlatform {
  id: string;
  name: string;
  handle: string;
  href: string;
  ariaLabel: string;
  badge: string;
  brandColor: string;
  brandBg: string;
  icon: React.ReactNode;
}

export function CommunitySocialBanner() {
  const platforms: SocialPlatform[] = [
    {
      id: 'telegram',
      name: 'Telegram Channel',
      handle: '@BseNexusOfficial',
      href: 'https://t.me/BseNexusOfficial',
      ariaLabel: 'Join official BSE Nexus Telegram Channel for instant sub-second filing alerts',
      badge: 'Sub-Second Alerts',
      brandColor: '#229ED9',
      brandBg: 'from-[#2AABEE] to-[#229ED9]',
      icon: (
        <svg viewBox="0 0 24 24" width={22} height={22} fill="white" aria-hidden="true" className="shrink-0">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      )
    },
    {
      id: 'instagram',
      name: 'Instagram',
      handle: '@bsenexus',
      href: 'https://www.instagram.com/bsenexus/',
      ariaLabel: 'Follow BSE Nexus on Instagram for corporate visual breakdowns and earnings stories',
      badge: 'Visual Stories',
      brandColor: '#E1306C',
      brandBg: 'from-[#f09433] via-[#dc2743] to-[#bc1888]',
      icon: (
        <svg viewBox="0 0 24 24" width={22} height={22} fill="white" aria-hidden="true" className="shrink-0">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      )
    },
    {
      id: 'x',
      name: 'X (Twitter)',
      handle: '@bsenexus',
      href: 'https://x.com/bsenexus',
      ariaLabel: 'Follow BSE Nexus on X for live regulatory filings and market updates',
      badge: 'Live Feed',
      brandColor: '#000000',
      brandBg: 'from-slate-900 to-black dark:from-slate-800 dark:to-slate-950',
      icon: (
        <svg viewBox="0 0 24 24" width={20} height={20} fill="white" aria-hidden="true" className="shrink-0">
          <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
        </svg>
      )
    },
    {
      id: 'threads',
      name: 'Threads',
      handle: '@bsenexus',
      href: 'https://www.threads.com/@bsenexus',
      ariaLabel: 'Follow BSE Nexus on Threads',
      badge: 'Market Notes',
      brandColor: '#000000',
      brandBg: 'from-zinc-900 to-black dark:from-zinc-800 dark:to-zinc-950',
      icon: (
        <svg viewBox="0 0 24 24" width={20} height={20} fill="white" aria-hidden="true" className="shrink-0">
          <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z" />
        </svg>
      )
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      handle: 'bse-nexus',
      href: 'https://www.linkedin.com/company/bse-nexus',
      ariaLabel: 'Follow BSE Nexus on LinkedIn for corporate research and filings updates',
      badge: 'Corporate Research',
      brandColor: '#0A66C2',
      brandBg: 'from-[#0A66C2] to-[#004182]',
      icon: (
        <svg viewBox="0 0 24 24" width={20} height={20} fill="white" aria-hidden="true" className="shrink-0">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451c.979 0 1.778-.773 1.778-1.729V1.73C24 .774 23.205 0 22.225 0z" />
        </svg>
      )
    }
  ];

  return (
    <section 
      className="relative py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      aria-label="Official Social Channels and Active Trader Community"
    >
      <div className="rounded-3xl bg-white/95 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/80 p-6 sm:p-10 lg:p-12 shadow-xl shadow-slate-200/40 dark:shadow-black/50 transition-all duration-300">
        
        {/* Top Header Row with Live Network Indicator */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span>Official Channels &amp; Discussion Hub</span>
            </div>
            
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
              Follow BSE Nexus Across All Platforms
            </h3>
            
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-normal max-w-2xl leading-relaxed">
              Real-time exchange dispatches, visual financial infographics, and an active community of serious market participants.
            </p>
          </div>

          {/* Primary Action: Active Trader Telegram Discussion Group */}
          <a
            href="https://t.me/BseNexusDiscussion"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join BSE Nexus Active Trader Discussion Group on Telegram"
            className="group relative inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-[#229ED9] via-[#0088cc] to-[#0077b5] hover:from-[#1b8fc7] hover:to-[#00669c] text-white font-bold text-sm sm:text-base shadow-lg shadow-sky-500/30 hover:shadow-xl hover:shadow-sky-500/40 active:scale-95 transition-all duration-200 shrink-0 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" width={20} height={20} fill="white" aria-hidden="true">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </div>
            
            <div className="flex flex-col text-left">
              <span className="font-extrabold text-sm sm:text-base leading-tight">
                Join Discussion Group
              </span>
              <span className="text-xs text-sky-100 font-mono font-medium">
                @BseNexusDiscussion
              </span>
            </div>

            <ArrowUpRight className="w-5 h-5 ml-1 text-white/80 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </a>
        </div>

        {/* Official Channels Grid (Authentic Brand Badges) */}
        <div className="flex flex-wrap justify-center sm:grid sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 pt-5 sm:pt-8">
          {platforms.map((item) => (
            <a
              key={item.id}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={item.ariaLabel}
              title={item.name}
              className="group p-2 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/90 dark:border-slate-700/70 hover:border-sky-500/50 dark:hover:border-sky-500/50 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between gap-0 sm:gap-4 cursor-pointer hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                {/* Official Brand Logo Circle */}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.brandBg} flex items-center justify-center shadow-md shadow-black/10 group-hover:scale-105 transition-transform`}>
                  {item.icon}
                </div>

                <span className="hidden sm:inline text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60">
                  {item.badge}
                </span>
              </div>

              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-sm group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                  <span>{item.name}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
                
                <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 mt-0.5 block">
                  {item.handle}
                </span>
              </div>
            </a>
          ))}
        </div>

        {/* Bottom Trust & Authenticity Verification Bar */}
        <div className="mt-8 pt-6 border-t border-slate-200/70 dark:border-slate-800/70 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>All official social channels are verified directly by the BSE Nexus engineering team</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span>Official handle: @bsenexus</span>
          </div>
        </div>

      </div>
    </section>
  );
}
