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

export interface SpecialDayCard {
  id: string;
  tag: string;
  title: string;
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
  startsAt: string; // Active window start e.g. "2026-11-01T00:00:00+05:30"
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
    startsAt: '2026-11-01T00:00:00+05:30',
    endsAt: '2027-02-01T17:00:00+05:30',
    ctaText: 'View Special Story',
    disclaimer: 'Market data disclaimer: BSE Nexus provides information and analytical tools for research and educational purposes only. Market investments are subject to market risks. Not financial advice.',
    cards: [
      {
        id: 'budget-timings',
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
            text: '09:00 AM – 09:08 AM IST for order entry and price discovery across all market segments.',
            tag: '09:00 AM'
          },
          {
            title: 'Finance Minister Address',
            text: 'Speech commences at 11:00 AM IST with real-time fiscal deficit and capital expenditure announcements.',
            tag: '11:00 AM'
          },
          {
            title: 'Settlement & Margins',
            text: 'Standard T+1 settlement rules apply. Peak margin requirements enforced throughout the day.',
            tag: 'RISK'
          }
        ],
        actionLabel: 'Check Market Calendar',
        actionTab: 'results-calendar',
        footerNote: 'Normal trading segments (Equity, F&O, Debt) operate concurrently.'
      },
      {
        id: 'budget-history',
        tag: 'Historical Market Patterns',
        title: 'How SENSEX & NIFTY React to Budget Day',
        subtitle: '10-Year historical volatility and post-speech market trajectories',
        badge: 'HISTORICAL PATTERNS',
        themeTone: 'amber',
        headlineStat: {
          value: '±2.4%',
          label: 'Average Intraday SENSEX Range',
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
        footerNote: 'Past performance does not guarantee future market behavior.'
      },
      {
        id: 'budget-sectors',
        tag: 'Sectors to Watch',
        title: 'Key Policy Focus Sectors',
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
        tag: 'Execution & Safety',
        title: 'Disciplined Trading Guidelines',
        subtitle: 'Institutional risk management best practices for high-volatility special sessions',
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
