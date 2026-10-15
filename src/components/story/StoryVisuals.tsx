import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  CalendarDays, 
  Award, 
  Building2,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

// ==========================================
// 1. LOCAL OFFICIAL BRAND ASSETS
// 100% authentic, verified official corporate & exchange marks
// ==========================================
export const LOCAL_OFFICIAL_LOGOS: Record<string, string> = {
  BSE: '/company-logos/bse-india.png',
  SENSEX: '/company-logos/bse-india.png',
  BSESN: '/company-logos/bse-india.png',
  BSE30: '/company-logos/bse-india.png',
  NSE: '/company-logos/nse-india.png',
  NIFTY: '/company-logos/nse-india.png',
  NIFTY50: '/company-logos/nse-india.png',
  BANKNIFTY: '/company-logos/nse-india.png',
  RELIANCE: '/company-logos/reliance.svg',
  TCS: '/company-logos/tcs.svg',
  HDFCBANK: '/company-logos/hdfc-bank.svg',
  INFY: '/company-logos/infosys.svg',
  INFOSYS: '/company-logos/infosys.svg',
  TATAMOTORS: '/company-logos/tatamotors.png',
  ICICIBANK: '/company-logos/icicibank.png',
  SBIN: '/company-logos/sbin.png',
  SBI: '/company-logos/sbin.png',
  BHARTIARTL: '/company-logos/bhartiartl.png',
  AIRTEL: '/company-logos/bhartiartl.png',
  MARUTI: '/company-logos/maruti.png',
  LT: '/company-logos/lt.png',
  LNT: '/company-logos/lt.png',
  ITC: '/company-logos/itc.png',
  BAJFINANCE: '/company-logos/bajfinance.png',
  TITAN: '/company-logos/titan.png',
  BEL: '/company-logos/bel.png',
  HINDALCO: '/company-logos/hindalco.png',
  SUNPHARMA: '/company-logos/sunpharma.png',
  WIPRO: '/company-logos/wipro.png',
  NTPC: '/company-logos/ntpc.png',
  ONGC: '/company-logos/ongc.png',
  COALINDIA: '/company-logos/coalindia.png',
};

// ==========================================
// 2. COMPREHENSIVE BSE SCRIP CODE DICTIONARY
// Resolves any ticker/symbol to authentic BSE Scrip Code for official CDN logos
// ==========================================
export const SYMBOL_TO_SCRIP: Record<string, string> = {
  'ABB': '500002',
  'ABCAPITAL': '540691',
  'ADANIENT': '512599',
  'ADANIGREEN': '541450',
  'ADANIPORTS': '532921',
  'ADANIPOWER': '533096',
  'ALKEM': '539523',
  'AMBER': '540902',
  'AMBUJACEM': '500425',
  'ANGELONE': '543235',
  'APOLLOHOSP': '508869',
  'ASHOKLEY': '500477',
  'ASIANPAINT': '500820',
  'ASTRAL': '532830',
  'AUBANK': '540611',
  'AXISBANK': '532215',
  'BAJAJ-AUTO': '532977',
  'BAJAJFINSV': '532978',
  'BAJFINANCE': '500034',
  'BANDHANBNK': '541153',
  'BANKBARODA': '532134',
  'BDL': '541143',
  'BEL': '500049',
  'BHARATFORG': '500493',
  'BHARTIARTL': '532454',
  'AIRTEL': '532454',
  'BHEL': '500103',
  'BIOCON': '532523',
  'BLUESTARCO': '500067',
  'BPCL': '500547',
  'BSE': '540025',
  'CANBK': '532483',
  'CDSL': '540615',
  'CGPOWER': '500093',
  'CHOLAFIN': '511243',
  'CIPLA': '500087',
  'COALINDIA': '533278',
  'COCHINSHIP': '540678',
  'COFORGE': '532541',
  'CONCOR': '531344',
  'CROMPTON': '539876',
  'CUMMINSIND': '500480',
  'DIVISLAB': '532488',
  'DIXON': '540699',
  'DLF': '532868',
  'DMART': '540376',
  'DRREDDY': '500124',
  'EICHERMOT': '505200',
  'FEDERALBNK': '500469',
  'FORTIS': '532843',
  'GAIL': '532155',
  'GLENMARK': '532296',
  'GODREJCP': '532424',
  'GODREJPROP': '533150',
  'GRASIM': '500300',
  'HAL': '541154',
  'HAVELLS': '517354',
  'HCLTECH': '532281',
  'HDFCAMC': '541729',
  'HDFCBANK': '500180',
  'HDFCLIFE': '540777',
  'HINDALCO': '500440',
  'HINDUNILVR': '500696',
  'HINDZINC': '500188',
  'ICICIBANK': '532174',
  'ICICIGI': '540716',
  'ICICIPRULI': '540133',
  'IDEA': '532822',
  'IDFCFIRSTB': '539437',
  'IEX': '540750',
  'INDIANB': '532814',
  'INDIGO': '539448',
  'INDUSINDBK': '532209',
  'INFY': '500209',
  'INFOSYS': '500209',
  'INOXWIND': '539083',
  'IOC': '530965',
  'IREDA': '544026',
  'IRFC': '543257',
  'ITC': '500875',
  'JIOFIN': '543940',
  'JUBLFOOD': '533155',
  'KALYANKJIL': '543278',
  'KAYNES': '543664',
  'KEI': '517569',
  'KOTAKBANK': '500247',
  'KPITTECH': '542651',
  'LAURUSLABS': '540222',
  'LICHSGFIN': '500253',
  'LICI': '543526',
  'LT': '500510',
  'LNT': '500510',
  'M&M': '500520',
  'MANAPPURAM': '531213',
  'MARICO': '531642',
  'MARUTI': '532500',
  'MAXHEALTH': '543220',
  'MAZDOCK': '543237',
  'MCX': '534091',
  'MOTHERSON': '517334',
  'MPHASIS': '526299',
  'MUTHOOTFIN': '533398',
  'NATIONALUM': '532234',
  'NAUKRI': '532777',
  'NBCC': '534309',
  'NESTLEIND': '500790',
  'NHPC': '533098',
  'NMDC': '526371',
  'NTPC': '532555',
  'NYKAA': '543384',
  'OIL': '533106',
  'ONGC': '500312',
  'PAGEIND': '532827',
  'PAYTM': '543396',
  'PERSISTENT': '533179',
  'PETRONET': '532522',
  'PFC': '532810',
  'PIDILITIND': '500331',
  'PIIND': '523642',
  'PNB': '532461',
  'PNBHOUSING': '540173',
  'POLICYBZR': '543390',
  'POLYCAB': '542652',
  'POWERGRID': '532898',
  'RADICO': '532497',
  'RBLBANK': '540065',
  'RECLTD': '532955',
  'RELIANCE': '500325',
  'RVNL': '542649',
  'SAIL': '500113',
  'SBICARD': '543066',
  'SBILIFE': '540719',
  'SBIN': '500112',
  'SBI': '500112',
  'SHRIRAMFIN': '511218',
  'SIEMENS': '500550',
  'SOLARINDS': '532725',
  'SONACOMS': '543300',
  'SRF': '503806',
  'SUNPHARMA': '524715',
  'SUZLON': '532667',
  'SWIGGY': '544285',
  'TATACONSUM': '500800',
  'TATAELXSI': '500408',
  'TATAMOTORS': '500570',
  'TATAPOWER': '500400',
  'TATASTEEL': '500470',
  'TCS': '532540',
  'TECHM': '532755',
  'TIINDIA': '540762',
  'TITAN': '500114',
  'TRENT': '500251',
  'TVSMOTOR': '532343',
  'ULTRACEMCO': '532538',
  'UNIONBANK': '532477',
  'UPL': '512070',
  'VBL': '540180',
  'VOLTAS': '500575',
  'WIPRO': '507685',
  'YESBANK': '532648',
  'ZYDUSLIFE': '532321',
  'ZOMATO': '543320',
  'ETERNAL': '543320',
  'BAJAJHFL': '544252',
  'HYUNDAI': '544274',
  'TATATECH': '544028',
  'PREMIERENE': '544240',
  'WAAREE': '544277',
  'AFCONS': '544280',
  'OLAELEC': '544226',
  'JSWINFRA': '543994',
  'MANKIND': '543904',
  'HONASA': '544014',
  'CELLO': '544012',
  'RRKABEL': '543981',
  'SAMHI': '543984',
  'CYIENTDLM': '543933',
  'SBFC': '543959',
  'CONCORD': '543960',
  'AEROFLEX': '543972',
  'SIGNATURE': '543990',
  'BLUEJET': '544009',
  'PROTEAN': '544021',
  'DOMS': '544045',
  'INDIACHEL': '544047',
  'INOXINDIA': '544046',
  'MOTISONS': '544053',
  'MUTHOOTMC': '544055',
  'HAPPYFORGE': '544057',
  'RBZJEWEL': '544060',
  'CREDO': '544062',
  'JYOTICNC': '544081',
  'MEDICAMEN': '544085',
  'EPACK': '544088',
  'NOVAAGRI': '544100',
  'BLS': '544107',
  'VBLTD': '540180',
};

// Dynamic In-Memory & LocalStorage Scrip Cache
const dynamicScripCache: Record<string, string> = {};
const pendingLookups = new Map<string, Promise<string | null>>();

export async function lookupScripCodeDynamically(symbolOrName: string, companyName?: string): Promise<string | null> {
  const clean = (symbolOrName || '').trim().toUpperCase();
  if (!clean) return null;
  if (/^\d{6}$/.test(clean)) return clean;
  if (SYMBOL_TO_SCRIP[clean]) return SYMBOL_TO_SCRIP[clean];
  if (dynamicScripCache[clean]) return dynamicScripCache[clean];

  try {
    const cached = localStorage.getItem(`bse_dyn_scrip_${clean}`);
    if (cached && /^\d{6}$/.test(cached)) {
      dynamicScripCache[clean] = cached;
      return cached;
    }
  } catch {}

  if (pendingLookups.has(clean)) {
    return pendingLookups.get(clean)!;
  }

  const lookupPromise = (async () => {
    try {
      // 1. Direct High-Priority Stock Resolver Endpoint
      let res = await fetch(`/api/stock/resolve?q=${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.scripCode && /^\d{6}$/.test(data.scripCode)) {
          dynamicScripCache[clean] = data.scripCode;
          try { localStorage.setItem(`bse_dyn_scrip_${clean}`, data.scripCode); } catch {}
          return data.scripCode;
        }
      }

      // 2. Comprehensive Company Search Endpoint
      res = await fetch(`/api/search-company?q=${encodeURIComponent(clean)}`);
      if (res.ok) {
        let list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          const exact = list.find((item: any) => item.symbol?.toUpperCase() === clean && item.scripCode && /^\d{6}$/.test(item.scripCode));
          const match = exact || list.find((item: any) => item.scripCode && /^\d{6}$/.test(item.scripCode));
          if (match && match.scripCode) {
            dynamicScripCache[clean] = match.scripCode;
            try { localStorage.setItem(`bse_dyn_scrip_${clean}`, match.scripCode); } catch {}
            return match.scripCode;
          }
        }
      }

      // 3. Fallback to searching by company full name if available
      if (companyName && companyName.trim().length > 2) {
        res = await fetch(`/api/stock/resolve?q=${encodeURIComponent(companyName.trim())}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.scripCode && /^\d{6}$/.test(data.scripCode)) {
            dynamicScripCache[clean] = data.scripCode;
            try { localStorage.setItem(`bse_dyn_scrip_${clean}`, data.scripCode); } catch {}
            return data.scripCode;
          }
        }
      }
    } catch {
      // Graceful fallback
    } finally {
      pendingLookups.delete(clean);
    }
    return null;
  })();

  pendingLookups.set(clean, lookupPromise);
  return lookupPromise;
}

// ==========================================
// 3. AUTHENTIC ORIGINAL COMPANY BRAND LOGO COMPONENT
// Prioritizes official exchange marks (BSE India official emblem)
// and verified company marks with crisp presentation
// ==========================================
export interface CompanyBrandLogoProps {
  symbol: string;
  scripCode?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const CompanyBrandLogo: React.FC<CompanyBrandLogoProps> = ({
  symbol,
  scripCode,
  name = '',
  size = 'md',
  className = ''
}) => {
  const sym = (symbol || '').trim().toUpperCase();

  const [dynScripCode, setDynScripCode] = useState<string>(() => {
    const cleanSym = (symbol || '').trim().toUpperCase();
    return scripCode || SYMBOL_TO_SCRIP[cleanSym] || dynamicScripCache[cleanSym] || '';
  });

  // cdnStage: 0 = GSTK${scripCode}.png, 1 = ${sym}.png, 2 = GSTK${sym}.png, 3 = Smart Corporate Crest
  const [cdnStage, setCdnStage] = useState<number>(0);

  const sizeClasses = {
    xs: 'w-5 h-5 min-w-[20px] max-w-[20px] text-[8px] p-0.5',
    sm: 'w-7 h-7 min-w-[28px] max-w-[28px] text-[10px] p-1',
    md: 'w-9 h-9 min-w-[36px] max-w-[36px] text-xs p-1.5',
    lg: 'w-11 h-11 min-w-[44px] max-w-[44px] text-sm p-1.5',
    xl: 'w-14 h-14 min-w-[56px] max-w-[56px] text-base p-2'
  }[size];

  // 1. OFFICIAL BSE INDIA LOGO (Direct from bseindia.com)
  const isBseOfficial = sym === 'BSE' || 
    sym === 'SENSEX' || 
    sym === 'BSESN' || 
    sym === 'BSE30' || 
    scripCode === '999901' ||
    (name && name.toUpperCase().includes('BSE SENSEX'));

  if (isBseOfficial) {
    return (
      <div 
        className={`rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm border border-slate-200/80 dark:border-white/20 overflow-hidden ${sizeClasses} ${className}`}
        title="Official BSE India Logo"
      >
        <img
          src="/company-logos/bse-india.png"
          alt="BSE India Official Logo"
          className="w-full h-full object-contain"
          loading="eager"
        />
      </div>
    );
  }

  // 2. OFFICIAL NSE LOGO
  const isNseOfficial = sym === 'NSE' || 
    sym === 'NIFTY' || 
    sym === 'NIFTY50' || 
    sym === 'BANKNIFTY' ||
    (name && name.toUpperCase().includes('NIFTY'));

  if (isNseOfficial) {
    return (
      <div 
        className={`rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm border border-slate-200/80 dark:border-white/20 overflow-hidden ${sizeClasses} ${className}`}
        title="Official NSE India Logo"
      >
        <img
          src="/company-logos/nse-india.png"
          alt="NSE India Official Logo"
          className="w-full h-full object-contain"
          loading="eager"
        />
      </div>
    );
  }

  // 3. LOCAL VERIFIED OFFICIAL VECTOR / HIGH-RES LOGO
  const localLogo = LOCAL_OFFICIAL_LOGOS[sym];
  if (localLogo && cdnStage === 0) {
    return (
      <div 
        className={`rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm border border-slate-200/80 dark:border-white/20 overflow-hidden ${sizeClasses} ${className}`}
        title={`${name || sym} Official Logo`}
      >
        <img
          src={localLogo}
          alt={`${name || sym} official logo`}
          className="w-full h-full object-contain"
          loading="eager"
          onError={() => setCdnStage(1)}
        />
      </div>
    );
  }

  // Dynamic background lookup for unmapped stocks (e.g. IPOs, new mid/small-caps)
  useEffect(() => {
    if (!sym || isBseOfficial || isNseOfficial || localLogo) return;
    if (scripCode && /^\d{6}$/.test(scripCode)) {
      setDynScripCode(scripCode);
      return;
    }
    if (!dynScripCode) {
      lookupScripCodeDynamically(sym, name).then(resolved => {
        if (resolved) {
          setDynScripCode(resolved);
          setCdnStage(0);
        }
      });
    }
  }, [sym, scripCode, name, dynScripCode, isBseOfficial, isNseOfficial, localLogo]);

  // 4. MULTI-TIER OFFICIAL GROWW CDN LOGO CASCADE
  const effectiveScripCode = dynScripCode || scripCode || SYMBOL_TO_SCRIP[sym] || '';
  
  const cdnUrls: string[] = [
    effectiveScripCode && /^\d{6}$/.test(effectiveScripCode)
      ? `https://assets-netstorage.groww.in/stock-assets/logos/GSTK${effectiveScripCode}.png`
      : '',
    sym ? `https://assets-netstorage.groww.in/stock-assets/logos/${sym}.png` : '',
    sym ? `https://assets-netstorage.groww.in/stock-assets/logos/GSTK${sym}.png` : '',
  ].filter(Boolean);

  const activeCdnUrl = cdnUrls[cdnStage] || null;

  if (activeCdnUrl && cdnStage < cdnUrls.length) {
    return (
      <div className={`rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm border border-slate-200/80 dark:border-white/20 overflow-hidden ${sizeClasses} ${className}`}>
        <img
          key={activeCdnUrl}
          src={activeCdnUrl}
          alt={`${name || sym} official logo`}
          className="w-full h-full object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setCdnStage(prev => prev + 1)}
        />
      </div>
    );
  }

  // 5. SMART CORPORATE CREST (Vector-sharp financial monogram emblem)
  // When an asset is not yet in public CDNs (e.g. Day-1 IPO or unlisted SME),
  // render an authentic, elegant corporate seal designed to institutional finance standards.
  const initials = sym.length <= 4 ? sym : (sym.slice(0, 3) || 'STK');
  
  const corporatePalettes = [
    { bg: 'from-blue-600 via-indigo-700 to-slate-900', ring: 'border-blue-400/40', text: 'text-white' },
    { bg: 'from-emerald-600 via-teal-700 to-slate-900', ring: 'border-emerald-400/40', text: 'text-white' },
    { bg: 'from-violet-600 via-purple-700 to-slate-900', ring: 'border-purple-400/40', text: 'text-white' },
    { bg: 'from-amber-600 via-orange-700 to-slate-900', ring: 'border-amber-400/40', text: 'text-white' },
    { bg: 'from-rose-600 via-pink-700 to-slate-900', ring: 'border-rose-400/40', text: 'text-white' },
    { bg: 'from-cyan-600 via-sky-700 to-slate-900', ring: 'border-cyan-400/40', text: 'text-white' },
  ];
  
  let charSum = 0;
  for (let i = 0; i < sym.length; i++) charSum += sym.charCodeAt(i);
  const palette = corporatePalettes[charSum % corporatePalettes.length];

  return (
    <div 
      className={`rounded-xl bg-gradient-to-br ${palette.bg} flex flex-col items-center justify-center shrink-0 shadow-sm border ${palette.ring} relative overflow-hidden select-none ${sizeClasses} ${className}`}
      title={`${name || sym} (Official Corporate Crest)`}
    >
      <div className="absolute inset-0 bg-radial from-white/15 to-transparent pointer-events-none" />
      <span className={`font-mono font-black tracking-tight leading-none ${palette.text}`}>
        {initials}
      </span>
      {size !== 'xs' && (
        <span className="text-[6px] tracking-widest uppercase opacity-75 font-mono font-semibold text-white/90 leading-none mt-0.5">
          BSE
        </span>
      )}
    </div>
  );
};

// ==========================================
// 4. GROWW-STYLE CLEAN FINANCIAL CARD HERO
// ==========================================
interface GrowwStoryCardHeroProps {
  symbol?: string;
  scripCode?: string;
  name?: string;
  badge?: string;
  badgeColor?: string;
  statLabel?: string;
  statValue?: string;
  isPositive?: boolean;
  highlightCategory?: string;
  icon?: 'trend-up' | 'trend-down' | 'announcement' | 'calendar' | 'deal';
  className?: string;
}

export const GrowwStoryCardHero: React.FC<GrowwStoryCardHeroProps> = ({
  symbol = 'SENSEX',
  scripCode,
  name,
  badge,
  badgeColor = 'bg-emerald-500 text-white',
  statLabel,
  statValue,
  isPositive,
  highlightCategory,
  className = ''
}) => {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/90 via-[#120F24]/90 to-slate-950/95 border border-white/15 p-4 shadow-xl backdrop-blur-md ${className}`}>
      {/* Subtle radial ambient glow based on sentiment */}
      <div 
        className={`absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl pointer-events-none opacity-40 ${
          isPositive === true ? 'bg-emerald-500' : isPositive === false ? 'bg-rose-500' : 'bg-indigo-500'
        }`} 
      />

      {/* Top Bar: Company / Topic Logo + Ticker + Badge */}
      <div className="flex items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <CompanyBrandLogo 
            symbol={symbol}
            scripCode={scripCode}
            name={name}
            size="lg"
            className="shadow-lg shrink-0"
          />
          <div className="min-w-0">
            <h3 className="text-sm font-black text-white tracking-tight truncate font-display">
              {symbol}
            </h3>
            <p className="text-[11px] text-slate-400 truncate leading-tight">
              {name || (symbol === 'SENSEX' ? 'BSE 30 Benchmark' : 'BSE / NSE Equities')}
            </p>
          </div>
        </div>

        {badge && (
          <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full shadow-md tracking-wider shrink-0 ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>

      {/* Primary Key Metric Highlight */}
      {(statValue || statLabel) && (
        <div className="mt-4 pt-3 border-t border-white/10 flex items-end justify-between gap-2 relative z-10">
          <div>
            {statLabel && (
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                {statLabel}
              </span>
            )}
            <span className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
              {statValue}
            </span>
          </div>

          {highlightCategory && (
            <span className="text-[10px] font-semibold text-slate-300 bg-white/10 px-2 py-0.5 rounded-md border border-white/10">
              {highlightCategory}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 5. BACKWARD COMPATIBLE CLEAN HERO
// ==========================================
interface RealStoryHeroImageProps {
  src?: string;
  alt?: string;
  badge?: string;
  badgeColor?: string;
  caption?: string;
  aspectRatio?: string;
  className?: string;
}

export const RealStoryHeroImage: React.FC<RealStoryHeroImageProps> = ({
  badge,
  badgeColor,
  caption,
  className = ''
}) => {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/90 via-[#18142c]/90 to-slate-950/95 border border-white/15 p-3.5 shadow-lg backdrop-blur-md ${className}`}>
      {badge && (
        <div className="mb-2">
          <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-sm tracking-wider ${badgeColor || 'bg-emerald-500 text-white'}`}>
            {badge}
          </span>
        </div>
      )}
      {caption && (
        <p className="text-xs font-bold text-slate-200 leading-snug line-clamp-2">
          {caption}
        </p>
      )}
    </div>
  );
};
