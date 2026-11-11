export interface SpecialDayHeadlineStat {
  value: string;
  label: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface SpecialDayPoint {
  title: string;
  text: string;
  tag?: string;
}

export type SpecialDayCardKind = 'cover' | 'timing' | 'timeline' | 'history' | 'sectors' | 'safety';

export interface SpecialDayCard {
  id: string;
  kind: SpecialDayCardKind;
  tag: string;
  title: string;
  /** Trailing part of the title rendered on its own line in gold (e.g. "Focus Sectors"). */
  titleAccent?: string;
  subtitle?: string;
  badge?: string;
  themeTone?: 'amber' | 'emerald' | 'purple' | 'blue' | 'rose';
  headlineStat?: SpecialDayHeadlineStat;
  points: SpecialDayPoint[];
  actionLabel?: string;
  actionTab?: string;
  footerNote?: string;
}

export interface SpecialDayConfig {
  id: string;
  enabled: boolean;
  title: string;
  shortTitle: string;
  badgeText: string;
  bannerNotice: string;
  sessionDate: string; // ISO string e.g. "2027-02-01T09:15:00+05:30"
  sessionLabel: string; // e.g. "Mon, 1 Feb 2027 · 09:15 AM IST"
  startsAt: string; // Active window start e.g. "2027-01-29T15:30:00+05:30" (after last trading day ends)
  endsAt: string; // Auto-hide after session end e.g. "2027-02-01T17:00:00+05:30"
  ctaText: string;
  disclaimer: string;
  cards: SpecialDayCard[];
}

export const SPECIAL_DAYS: SpecialDayConfig[] = [
  {
    id: 'union-budget-special-2027',
    enabled: true,
    title: 'Union Budget 2027 Special Session',
    shortTitle: 'Budget Day Special',
    badgeText: 'SPECIAL SESSION',
    bannerNotice: 'Union Budget 2027 Special Session · Live policy impact, sector radars & volatility briefing',
    sessionDate: '2027-02-01T09:15:00+05:30',
    sessionLabel: '1 Feb 2027 · 09:15 AM – 03:30 PM IST',
    startsAt: '2027-01-29T15:30:00+05:30',
    endsAt: '2027-02-01T17:00:00+05:30',
    ctaText: 'View Special Story',
    disclaimer: 'Market data disclaimer: BSE Nexus provides information and analytical tools for research and educational purposes only. Market investments are subject to market risks. Not financial advice.',
    cards: [
      {
        id: 'budget-cover',
        kind: 'cover',
        tag: 'Special Session',
        title: 'Budget Day',
        subtitle: 'SPECIAL • 2027',
        badge: 'SPECIAL SESSION',
        themeTone: 'amber',
        points: [],
        actionLabel: 'View Special Story',
        actionTab: 'home'
      },
      {
        id: 'budget-timing',
        kind: 'timing',
        tag: 'Session & Timings',
        title: 'Budget Day',
        // Display strings transcribed from sessionDate / sessionLabel above;
        // update them together with those fields at the pre-event content review.
        subtitle: 'Monday, 1 Feb',
        badge: 'TRADING',
        themeTone: 'purple',
        headlineStat: {
          value: '09:15 AM – 03:30 PM',
          label: 'Continuous Trading Window',
          trend: 'neutral'
        },
        points: [],
        actionLabel: 'Market Calendar',
        actionTab: 'results-calendar'
      },
      {
        id: 'budget-timings',
        kind: 'timeline',
        tag: 'Session & Timings',
        title: 'Special Trading Session Timings',
        subtitle: 'BSE & NSE live order matching schedule for the Union Budget announcement day',
        badge: 'SESSION TIMINGS',
        themeTone: 'purple',
        headlineStat: {
          value: '09:15 – 15:30',
          label: 'Continuous Trading Window',
          trend: 'neutral'
        },
        points: [
          {
            title: 'Pre-Open Session',
            text: 'Order entry & price discovery, 09:00–09:08 AM IST.',
            tag: '09:00 AM'
          },
          {
            title: 'Finance Minister Address',
            text: 'Speech with fiscal deficit & capex announcements.',
            tag: '11:00 AM'
          },
          {
            title: 'Settlement & Margins',
            text: 'Standard T+1 settlement. Peak margins all day.',
            tag: 'RISK'
          }
        ],
        actionLabel: 'Check Market Calendar',
        actionTab: 'results-calendar',
        footerNote: 'Normal trading segments (Equity, F&O, Debt) operate concurrently.'
      },
      {
        id: 'budget-history',
        kind: 'history',
        tag: 'Historical Market Patterns',
        title: 'How SENSEX & NIFTY react on Budget Day',
        subtitle: '10-Year historical volatility and post-speech market trajectories',
        badge: 'HISTORICAL PATTERNS',
        themeTone: 'amber',
        headlineStat: {
          value: '±2.4%',
          label: 'Average Intraday SENSEX Range · 10-year pattern',
          trend: 'up'
        },
        points: [
          {
            title: 'First-Hour Compression',
            text: 'Markets historically trade in a narrow range before the 11:00 AM speech as institutional desks wait for direct tax figures.',
            tag: 'PRE-SPEECH'
          },
          {
            title: 'Mid-Session Peak Volatility',
            text: 'India VIX typically spikes 15–28% during the speech between 11:30 AM and 01:00 PM as sectoral allocations are revealed.',
            tag: 'VOLATILITY'
          },
          {
            title: 'Afternoon Institutional Flow',
            text: 'Domestic and Foreign Institutional Investors (DIIs/FIIs) historically establish directional bias after 02:00 PM.',
            tag: 'POST-SPEECH'
          }
        ],
        actionLabel: 'View Market News',
        actionTab: 'news',
        footerNote: 'First hour stays narrow · Volatility peaks mid-session'
      },
      {
        id: 'budget-sectors',
        kind: 'sectors',
        tag: 'Sectors to Watch',
        title: 'Key Policy Focus Sectors',
        titleAccent: 'Focus Sectors',
        subtitle: 'Industries with high sensitivity to government expenditure and taxation shifts',
        badge: 'SECTOR INTEL',
        themeTone: 'emerald',
        headlineStat: {
          value: '₹11.1L Cr',
          label: 'Estimated Capital Outlay Baseline',
          trend: 'up'
        },
        points: [
          {
            title: 'Infrastructure & Capital Goods',
            text: 'Railways, defense manufacturing, highways, and public construction spend (L&T, BHEL, HAL).',
            tag: 'CAPEX'
          },
          {
            title: 'Renewables & Power Grids',
            text: 'Green hydrogen incentives, solar wafer subsidies, and transmission grid corridors (Tata Power, Power Grid).',
            tag: 'ENERGY'
          },
          {
            title: 'Banking & Financial Services',
            text: 'PSU bank recapitalization, credit growth support, and rural housing finance allocations.',
            tag: 'BANKING'
          }
        ],
        actionLabel: 'Explore Watchlists',
        actionTab: 'watchlists',
        footerNote: 'Monitor live BSE company filings for real-time order wins.'
      },
      {
        id: 'budget-guidelines',
        kind: 'safety',
        tag: 'Execution & Safety',
        title: 'Trade Budget Day with discipline',
        titleAccent: 'with discipline',
        subtitle: 'Institutional risk management for a high-volatility session',
        badge: 'SAFETY PLAYBOOK',
        themeTone: 'blue',
        headlineStat: {
          value: '100% Risk Cap',
          label: 'Strict Stop-Loss Discipline',
          trend: 'neutral'
        },
        points: [
          {
            title: 'Avoid Unhedged Overnight Positions',
            text: 'Wide bid-ask spreads during opening and policy announcements can trigger slippage on unhedged orders.',
            tag: 'RULE 1'
          },
          {
            title: 'Watch Real-Time BSE Filings',
            text: 'Corporate policy clarifications and capex announcements hit BSE regulatory disclosures first on BSE Nexus.',
            tag: 'RULE 2'
          },
          {
            title: 'Maintain Liquid Buffer',
            text: 'Keep margin headroom above 30% to withstand intraday volatility expansions without margin calls.',
            tag: 'RULE 3'
          }
        ],
        actionLabel: 'Go to Research Home',
        actionTab: 'home',
        footerNote: 'All trades carry capital risk. Use BSE Nexus for analytical intelligence.'
      }
    ]
  }
];

export function getActiveSpecialDay(now = Date.now()): SpecialDayConfig | null {
  for (const day of SPECIAL_DAYS) {
    if (!day.enabled) continue;
    const start = new Date(day.startsAt).getTime();
    const end = new Date(day.endsAt).getTime();
    if (now >= start && now <= end) {
      return day;
    }
  }
  return null;
}

export function isSpecialDayDismissed(dayId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(`bse_special_day_dismissed_${dayId}`) === 'true';
  } catch {
    return false;
  }
}

export function setSpecialDayDismissed(dayId: string, dismissed = true): void {
  if (typeof window === 'undefined') return;
  try {
    if (dismissed) {
      localStorage.setItem(`bse_special_day_dismissed_${dayId}`, 'true');
    } else {
      localStorage.removeItem(`bse_special_day_dismissed_${dayId}`);
    }
  } catch {}
}
