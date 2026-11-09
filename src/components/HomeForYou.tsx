import { readHomeResource } from '../utils/homeResources';
import { useVisibilityInterval } from '../hooks/useVisibilityInterval';
import { ADR_COMPANIES } from '../shared/adr';
import { selectPersonalResults, watchlistTerms } from '../utils/forYou';
import { useCalendarDialog } from '../hooks/useCalendarDialog';
import { PageHeading } from './ui/PageHeading';
import '../styles/overnight-adr.css';
import { OvernightAdr } from './adr/OvernightAdr';
import { HomeMarketNews } from './HomeMarketNews';
import { ImpactRadar } from './ImpactRadar';
import { HomeSkeleton } from './ui/PageSkeleton';
import { StoryCarouselBar } from './story/StoryCarouselBar';
import { TodayMarketStoryModal } from './TodayMarketStoryModal';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Check, 
  CheckCircle2,
  CalendarDays, 
  FileText, 
  Newspaper, 
  Bookmark, 
  ChevronRight, 
  Search, 
  X, 
  ExternalLink,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { customFetch } from '../api';
import { activeWatchlistIdentities } from '../shared/watchlistIdentity';
import { latestWatchlistUpdates } from '../utils/watchlistPreview';
import { useAuth } from '../context/AuthContext';
import { useIntelModal } from '../context/IntelModalContext';
import { formatFilingRelativeTime, formatCleanTime, formatDateOnly } from '../utils/timeFormat';
import { cleanBseSubject } from '../utils/cleanBseSubject';
import { getSafePdfUrl } from '../utils/pdfHelper';
import { parseMeetingDateTile } from '../utils/calendarDateTile';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useFeedDensity } from '../hooks/useFeedDensity';
import { HeliosPill, heliosCard } from './ui/helios';
import { springSnappy, containerStaggerVariants, itemFadeUpVariants, buttonTap } from '../utils/motionTokens';
import { ActionButton } from './ui/ActionButton';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STARTER_STOCKS = [
  { symbol: 'TATAMOTORS', scripCode: '500570', name: 'Tata Motors Ltd' },
  { symbol: 'RELIANCE', scripCode: '500325', name: 'Reliance Industries' },
  { symbol: 'INFY', scripCode: '500209', name: 'Infosys Ltd' },
  { symbol: 'HDFCBANK', scripCode: '500180', name: 'HDFC Bank Ltd' },
  { symbol: 'TCS', scripCode: '532540', name: 'Tata Consultancy Services' },
  { symbol: 'ITC', scripCode: '500875', name: 'ITC Ltd' },
  { symbol: 'LT', scripCode: '500510', name: 'Larsen & Toubro' },
  { symbol: 'BHARTIARTL', scripCode: '532454', name: 'Bharti Airtel' },
];

interface HomeForYouProps {
  onNavigate: (tabId: string) => void;
  isActive?: boolean;
}

export function HomeForYou({ onNavigate, isActive = true }: HomeForYouProps) {
  // Shared feed density (Settings screen) — visibly resizes home cards.
  const [density] = useFeedDensity();
  const homeCardPad = density === 'comfortable' ? 'p-5' : density === 'dense' ? 'p-3' : 'p-3.5';
  const homeGridGap = density === 'comfortable' ? 'gap-3.5' : density === 'dense' ? 'gap-2' : 'gap-2.5';
  const { user, profile, loading: accountLoading, authLoading, setIsAuthModalOpen } = useAuth();
  const { openIntelModal } = useIntelModal();

  const [watchlists, setWatchlists] = useState<any[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('bse_nexus_watchlist_cache');
        if (raw) {
          const parsed = JSON.parse(raw);
          const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
          if (items.length > 0) return items;
        }
      }
    } catch {}
    return [];
  });
  const verifiedLists = useRef<{owner:string; lists:any[]} | null>(null);
  const [homeWarning, setHomeWarning] = useState('');
  const [homeRefresh, setHomeRefresh] = useState(0);
  const [watchlistStatus, setWatchlistStatus] = useState<'loading' | 'ready' | 'error'>(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('bse_nexus_watchlist_cache');
        if (raw) {
          const parsed = JSON.parse(raw);
          const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
          if (items.length > 0) return 'ready';
        }
      }
    } catch {}
    return 'loading';
  });
  const [watchlistSymbols, setWatchlistSymbols] = useState<Set<string>>(() => {
    const syms = new Set<string>();
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('bse_nexus_watchlist_cache');
        if (raw) {
          const parsed = JSON.parse(raw);
          const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
          activeWatchlistIdentities(items).forEach(stock => {
            syms.add(stock.symbol);
            if (stock.scripCode) syms.add(stock.scripCode);
          });
        }
      }
    } catch {}
    return syms;
  });
  const [resultError, setResultError] = useState(false);
  const [upcomingResults, setUpcomingResults] = useState<any[]>([]);
  const [allAnnouncements, setAllAnnouncements] = useState<any[]>([]);
  const [filingError, setFilingError] = useState(false);
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('bse_nexus_watchlist_cache');
        if (raw) {
          const parsed = JSON.parse(raw);
          const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
          if (items.length > 0) return false;
        }
      }
    } catch {}
    return true;
  });
  const [hasLoaded, setHasLoaded] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('bse_nexus_watchlist_cache');
        if (raw) {
          const parsed = JSON.parse(raw);
          const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
          if (items.length > 0) return true;
        }
      }
    } catch {}
    return false;
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [addingStock, setAddingStock] = useState<string | null>(null);
  const [targetListId, setTargetListId] = useState('');
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [searchResults, setSearchResults] = useState<typeof STARTER_STOCKS>([]);
  const [searching, setSearching] = useState(false);
  const addingRef = useRef<string | null>(null);
  const mutationVersion = useRef(0);
  const ownerRef = useRef('');
  const mounted = useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const addDialog = useCalendarDialog(isAddModalOpen, () => setIsAddModalOpen(false));
  useEffect(() => {
    if (isAddModalOpen && (addSuccess || addError)) addDialog.ref.current?.focus({ preventScroll: true });
  }, [isAddModalOpen, addSuccess, addError]);

  // Detail sheets
  const [selectedFiling, setSelectedFiling] = useState<any | null>(null);
  const [selectedResult, setSelectedResult] = useState<any | null>(null);
  const filingDialog = useCalendarDialog(Boolean(selectedFiling), () => setSelectedFiling(null));
  const resultDialog = useCalendarDialog(Boolean(selectedResult), () => setSelectedResult(null));

  // Story modal state
  const [storyModalOpen, setStoryModalOpen] = useState<boolean>(false);
  const [selectedStoryChapter, setSelectedStoryChapter] = useState<string | undefined>(undefined);

  // Prevent background scroll chaining when any modal or sheet is open
  useBodyScrollLock(Boolean(isAddModalOpen || selectedFiling || selectedResult));

  const identity = user?.isAnonymous ? 'guest' : user?.uid || profile?.uid || 'guest';
  const loadedIdentity = useRef(identity); ownerRef.current = identity;
  useEffect(() => { ++mutationVersion.current; addingRef.current=null; setAddingStock(null);setModalSearch('');setSearchResults([]);setIsAddModalOpen(false); setTargetListId(''); setNewWatchlistName(''); setAddError(''); setAddSuccess(''); setSelectedFiling(null); setSelectedResult(null); }, [identity]);
  useEffect(() => { if (!targetListId && watchlists.length) setTargetListId(String((watchlists.find(w=>w.is_active===1||w.is_active===true)||watchlists[0]).id)); }, [watchlists,targetListId]);
  useEffect(() => {
    const refresh = (event: Event) => { if (isActive && (event as CustomEvent).detail?.tab === 'home') setHomeRefresh(v => v + 1); };
    const changed = () => { if (isActive) setHomeRefresh(v => v + 1); };
    window.addEventListener('bse_nav_tab_refresh', refresh);
    window.addEventListener('watchlists-changed', changed);
    return () => { window.removeEventListener('bse_nav_tab_refresh', refresh); window.removeEventListener('watchlists-changed', changed); };
  }, [isActive]);
  useEffect(() => {
    if (!isActive) return;
    if ((accountLoading || authLoading) && (!user || user.isAnonymous)) return;
    const controller = new AbortController(), signal = controller.signal;
    if (loadedIdentity.current !== identity) {
      loadedIdentity.current = identity; verifiedLists.current = null; setHomeWarning('');
      if (!watchlists.length) {
        setWatchlistStatus('loading'); setHasLoaded(false);
      }
      setFilingError(false); setUpcomingResults([]); setAllAnnouncements([]);
    }
    const fetchHomeData = async () => {
      setLoading(true); setWatchlistStatus(previous=>previous==='ready'?'ready':'loading');
      try {
        const signedIn = identity !== 'guest';
        const [wl, cal] = await Promise.all([
          signedIn ? readHomeResource<any[]>(customFetch, '/api/watchlists', signal, Array.isArray) : Promise.resolve({ok:true as const,value:[]}),
          signedIn ? readHomeResource<any>(customFetch, '/api/results-calendar?filter=all&scope=watchlist', signal, value=>value?.success!==false && Array.isArray(value?.items)) : Promise.resolve({ok:true as const,value:{items:[]}}),
        ]);
        if (signal.aborted) return;
        let currentLists:any[] = [];
        if (wl.ok === true) {
          currentLists=wl.value; verifiedLists.current={owner:identity,lists:currentLists}; setHomeWarning(''); setWatchlistStatus('ready');
          try {
            localStorage.setItem('bse_nexus_watchlist_cache', JSON.stringify({ items: currentLists, ts: Date.now(), owner: identity }));
          } catch {}
        } else if ('status' in wl && wl.status!==401 && wl.status!==403 && verifiedLists.current?.owner===identity) {
          currentLists=verifiedLists.current.lists; setWatchlistStatus('ready');
          setHomeWarning('Watchlist refresh unavailable. Showing your last verified list.');
        } else if (watchlists.length > 0) {
          currentLists=watchlists; setWatchlistStatus('ready');
        } else {
          verifiedLists.current=null; setWatchlistStatus('error'); setHomeWarning('');
        }
        const syms=new Set<string>();
        activeWatchlistIdentities(currentLists).forEach(stock=>{syms.add(stock.symbol);if(stock.scripCode)syms.add(stock.scripCode);});
        setWatchlists(currentLists); setWatchlistSymbols(syms);
        setResultError(!cal.ok && signedIn);
        if (cal.ok) setUpcomingResults(selectPersonalResults(cal.value.items,currentLists));
        else setUpcomingResults(previous=>selectPersonalResults(previous,currentLists));
        if (!syms.size) { setFilingError(false); setAllAnnouncements([]); return; }
        const filings=await readHomeResource<any[]>(customFetch, `/api/announcements?limit=100&symbols=${encodeURIComponent([...syms].join(','))}`,signal,Array.isArray);
        if (!signal.aborted) {
          setFilingError(!filings.ok);
          if (filings.ok === true) setAllAnnouncements(filings.value);
          else if (filings.status === 401 || filings.status === 403) setAllAnnouncements([]);
        }
      } finally { if (!signal.aborted) {setLoading(false);setHasLoaded(true);} }
    };
    void fetchHomeData().catch(()=>{}); // Parent cancellation; resource errors are handled independently.
    return ()=>controller.abort();
  }, [identity,isActive,homeRefresh,accountLoading,authLoading]);

  useEffect(()=>{
    if (watchlistStatus==='ready' && loadedIdentity.current===identity && verifiedLists.current?.owner===identity)
      verifiedLists.current={owner:identity,lists:watchlists};
  },[watchlists,watchlistStatus,identity]);
  useEffect(()=>{
    const resume=()=>{if(isActive && !document.hidden)setHomeRefresh(value=>value+1);};
    window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
    return()=>{window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);};
  },[isActive]);

  useEffect(() => {
    if (!isAddModalOpen || !modalSearch.trim()) { setSearchResults([]); setSearching(false); return; }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await customFetch(`/api/search-company?q=${encodeURIComponent(modalSearch.trim())}`, {signal:controller.signal});
        const rows = await res.json();
        if (!res.ok || !Array.isArray(rows)) throw new Error('Company search is unavailable.');
        if (!controller.signal.aborted) setSearchResults(rows.map(row=>({symbol:row.symbol,scripCode:row.scripCode,name:row.name||row.companyName||row.symbol})));
      } catch { if (!controller.signal.aborted) { setSearchResults([]); setAddError('Company search could not load. Try again.'); } }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [isAddModalOpen,modalSearch]);

  const handleAddStock = async (symbol: string, scripCode?: string, name?: string) => {
    if (!user || user.isAnonymous) { setIsAuthModalOpen(true); return; }
    if (addingRef.current) return;
    const upperSym = symbol.trim().toUpperCase(); if (!upperSym) return;
    const owner = identity;
    const version=mutationVersion.current; const token=`${owner}:${version}`;
    const current = () => mounted.current && ownerRef.current === owner && mutationVersion.current===version;
    const controller = new AbortController(); const timeout = setTimeout(()=>controller.abort(),20000);
    addingRef.current = token; setAddingStock(upperSym); setAddError(''); setAddSuccess('');
    try {
      let target = watchlists.find(list=>String(list.id)===targetListId);
      if (targetListId === 'new' || !watchlists.length) {
        const name = newWatchlistName.trim();
        if (!name) throw new Error('Enter a name for the new watchlist.');
        const response = await customFetch('/api/watchlists', {method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
        const data = await response.json();
        if (!current()) return;
        if (!response.ok || !data.id) throw new Error(data.error || 'Watchlist could not be created.');
        target = data;
        setWatchlists(previous=>[...previous,data]); setTargetListId(String(data.id)); setNewWatchlistName('');
        window.dispatchEvent(new Event('watchlists-changed'));
      }
      if (!target) throw new Error('Choose a watchlist first.');
      const response = await customFetch(`/api/watchlists/${encodeURIComponent(target.id)}/symbols`, {method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({symbol:upperSym,scripCode:scripCode||undefined,companyName:name,priority:'HIGH'})});
      const data = await response.json().catch(()=>null);
      if (!current()) return;
      if (!response.ok || data?.success===false) throw new Error(data?.error || 'Stock could not be added.');
      setWatchlists(previous=>previous.map(list=>String(list.id)===String(target.id)?{...list,items:[...(list.items||[]),{symbol:upperSym,scripCode,companyName:name}]}:list));
      setAddSuccess(`Added to ${target.name}.`); setHomeRefresh(value=>value+1);
      window.dispatchEvent(new Event('watchlists-changed'));
    } catch(error) { if (current()) setAddError(controller.signal.aborted ? 'Update timed out. Check your watchlist before retrying.' : error instanceof Error ? error.message : 'Could not confirm the update. Check your watchlist before retrying.'); }
    finally { clearTimeout(timeout); if(addingRef.current===token)addingRef.current=null; if (current()) setAddingStock(null); }
  };

  useVisibilityInterval(()=>setHomeRefresh(value=>value+1),120000,isActive);
  const sameIdentity = loadedIdentity.current === identity;
  const trackedCompanyCount = activeWatchlistIdentities(watchlists).length;
  const personalTerms = sameIdentity && watchlistStatus==='ready' ? watchlistTerms(watchlists) : [];
  const selectedList = watchlists.find(list=>String(list.id)===targetListId);
  const selectedStocks = new Set((selectedList?.items||[]).flatMap((item:any)=>typeof item==='string'?[item]:[item.symbol,item.scripCode]).filter(Boolean));
  const hasWatchlist = sameIdentity && watchlistStatus === 'ready' && watchlistSymbols.size > 0;

  // 1. Filtered Watchlist Filings
  const watchlistFilings = useMemo(() => {
    if (!hasWatchlist) return [];
    return latestWatchlistUpdates(allAnnouncements, watchlists);
  }, [allAnnouncements, watchlists, hasWatchlist]);

  // Starter stocks filtered by search query in modal
  const filteredStarterStocks = useMemo(() => {
    return modalSearch.trim() ? searchResults : STARTER_STOCKS;
  }, [modalSearch,searchResults]);

  return (
    <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-6">
      
      {/* 1. Top Header: Calm Page Title & ONLY Primary Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-[#262335]">
        <div className="space-y-0.5">
          <PageHeading active={isActive} className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-display">
            For You
          </PageHeading>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-normal">
            Your market. Your watchlist. One place.
          </p>
        </div>

        {/* The ONLY Primary Button on For You home */}
        <motion.button
          type="button"
          whileTap={buttonTap}
          transition={springSnappy}
          onClick={() => {setIsAddModalOpen(true);setAddError('');setAddSuccess('');}}
          className="min-h-[44px] sm:min-h-[38px] px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer shrink-0 select-none"
        >
          <Plus size={15} />
          <span>Add stocks</span>
        </motion.button>
      </div>

      {homeWarning && <p role="status" className="text-xs text-slate-500">{homeWarning} <button type="button" className="underline" onClick={()=>setHomeRefresh(value=>value+1)}>Retry refresh</button></p>}
      {/* 2. Focused Sections or Calm Summary */}
      {!sameIdentity || (loading && !hasLoaded) ? <HomeSkeleton /> : (
      <div className="space-y-6">
        {filingError && hasWatchlist && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{watchlistFilings.length ? 'Showing saved watchlist filings. Refresh unavailable.' : 'Watchlist filings could not be checked.'} <button type="button" className="underline" onClick={() => setHomeRefresh(value => value + 1)}>Retry filings</button></p>}

        {/* Watchlist Section */}
        {watchlistStatus === 'error' ? <section className="space-y-2"><h2 className="text-sm font-bold">Your Watchlist Updates</h2><p role="status" className="text-xs text-slate-500">Your watchlist could not be checked. <button type="button" className="underline" onClick={() => setHomeRefresh(value => value + 1)}>Retry</button></p></section> : !hasWatchlist ? (
          /* Empty Watchlist State with Actionable Starter Recommendations */
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
              Your Watchlist Updates
            </h2>
            <div className={cn(heliosCard, "p-5 text-center space-y-2")}>
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#201E2E] flex items-center justify-center mx-auto text-slate-400">
                <Bookmark size={18} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                No watchlist filings yet
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Add companies to your watchlist to see their real-time BSE regulatory filings, financial results, and board outcomes here.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="text-xs font-bold text-slate-900 dark:text-white underline underline-offset-4 hover:opacity-80 cursor-pointer"
                >
                  Choose companies to track &rarr;
                </button>
              </div>
            </div>
          </section>
        ) : watchlistFilings.length > 0 ? (
          /* Populated & Active Watchlist */
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
                Your Watchlist Updates
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('watchlists')}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <span>View all</span>
                <ChevronRight size={13} />
              </button>
            </div>

            <div className={cn("grid grid-cols-1 sm:grid-cols-2", homeGridGap)}>
              {watchlistFilings.map((filing, idx) => {
                const cleanSubj = cleanBseSubject(filing.subject || filing.details || '');
                const relTime = formatFilingRelativeTime(filing.bseTimestamp || filing.fetched_at || Date.now());

                return (
                  <button
                    type="button"
                    key={filing.id || idx}
                    onClick={() => setSelectedFiling(filing)}
                    className={cn(heliosCard, homeCardPad, "text-left transition-all cursor-pointer flex flex-col items-stretch justify-between gap-2 hover:shadow-[0_12px_28px_rgba(15,23,42,0.09)] dark:hover:shadow-[0_12px_28px_rgba(0,0,0,0.5)]")}
                  >
                    <span className="block space-y-1">
                      <span className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {filing.companyName}
                        </span>
                        <HeliosPill tone="slate">{relTime}</HeliosPill>
                      </span>
                      <span className="block text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {cleanSubj.headline}
                      </span>
                    </span>

                    <span className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-[#262335]">
                      <HeliosPill tone="slate" dot={false} className="font-mono">BSE: {filing.scrip_cd}</HeliosPill>
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                        <span>Details</span>
                        <ChevronRight size={12} />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : filingError ? null : (
          /* Populated but Quiet Watchlist: Single calm summary */
          <div className={cn(heliosCard, density === 'comfortable' ? "p-5 sm:p-6" : density === 'dense' ? "p-4" : "p-5", "space-y-2")}>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={16} className="shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
                Nothing urgent from your watchlist today
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
              No recent filings were found in the loaded updates for your {trackedCompanyCount} tracked {trackedCompanyCount === 1 ? 'company' : 'companies'}.
            </p>
          </div>
        )}

        {/* SECTION 2: Upcoming Results / Upcoming earnings date */}
        {!upcomingResults.length && hasWatchlist && <section className="space-y-2"><h2 className="text-sm font-bold">Your Results · Today &amp; Upcoming</h2><p role="status" className="text-xs text-slate-500">{resultError ? 'Result dates could not be checked. Try refreshing.' : 'No saved result dates in the next 7 days for your watchlist.'}</p></section>}
        {hasWatchlist && upcomingResults.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
                Your Results · Today & Upcoming
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('results-calendar')}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <span>Earnings calendar</span>
                <ChevronRight size={13} />
              </button>
            </div>

            <div className={cn("grid grid-cols-1 sm:grid-cols-2", homeGridGap)}>
              {upcomingResults.map((item, idx) => {
                const meetingDateStr = item.meetingDate || (item.bseTimestamp ? formatDateOnly(item.bseTimestamp) : (item.meetingTimestamp ? formatDateOnly(item.meetingTimestamp) : ''));
                const tile = parseMeetingDateTile(meetingDateStr || undefined);
                const isToday = item.daysLeft === 0;
                const declaredToday = isToday && item.isDeclared===true;
                const daysLabel = declaredToday ? 'Declared today' : isToday ? 'Today · Awaiting filing' : item.daysLeft === 1 ? 'Tomorrow' : `In ${item.daysLeft} days`;
                const companyName = (item.scripCode === '500034' || item.symbol === 'BAJFINANCE' || item.companyName === 'BAJAJ AUTO F') ? 'Bajaj Finance Ltd' : item.companyName;

                return (
                  <button
                    type="button"
                    key={item.id || idx}
                    data-result-status={declaredToday ? 'declared-today' : isToday ? 'pending' : 'upcoming'}
                    onClick={() => setSelectedResult({ ...item, companyName, meetingDate: meetingDateStr || item.meetingDate })}
                    className={cn(heliosCard, homeCardPad, "text-left transition-all cursor-pointer flex flex-wrap items-center justify-between gap-2 hover:shadow-[0_12px_28px_rgba(15,23,42,0.09)] dark:hover:shadow-[0_12px_28px_rgba(0,0,0,0.5)]")}
                  >
                    <span className="flex items-center gap-3 min-w-0 flex-1 basis-40">
                      {/* Date block */}
                      <span className={cn(
                        "w-11 h-11 rounded-lg flex flex-col items-center justify-center shrink-0 border",
                        isToday
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white"
                          : "bg-slate-100 dark:bg-[#201E2E] text-slate-800 dark:text-slate-200 border-slate-200 dark:border-[#2D283E]"
                      )}>
                        <span className="text-xs font-black leading-none">{tile.day}</span>
                        <span className="text-[9px] font-bold uppercase opacity-80 mt-0.5">{tile.month}</span>
                      </span>

                      <span className="block space-y-0.5 min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {companyName}
                          </span>
                          {item.symbol && (
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              {item.symbol}
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                          {declaredToday ? `Result filed${item.resultDeclarationTime ? ' · '+formatCleanTime(item.resultDeclarationTime) : ''}` : item.purpose || 'Financial Results'}
                        </span>
                      </span>
                    </span>

                    <HeliosPill tone={declaredToday ? "emerald" : isToday ? "amber" : "slate"} pulseDot={isToday && !declaredToday} className="shrink-0">{daysLabel}</HeliosPill>
                  </button>
                );
              })}
            </div>
          </section>
        )}

      </div>
      )}

      {/* Market discovery follows the personal watchlist and result summaries. */}
      {/* Groww-Style Live Market Story Top Carousel Bar */}
      <StoryCarouselBar active={isActive} watchlistStatus={sameIdentity ? watchlistStatus : 'loading'} watched={personalTerms}
        onOpenStory={(chapterId) => {
          setSelectedStoryChapter(chapterId);
          setStoryModalOpen(true);
        }}
        className="pt-0 pb-1"
      />

      {sameIdentity && ADR_COMPANIES.some(company=>watchlistSymbols.has(company.symbol)||watchlistSymbols.has(company.scripCode)) && <OvernightAdr key={`adr-${identity}`} active={isActive && watchlistStatus==='ready'} watchlistOnly density={density} watched={sameIdentity && watchlistStatus==='ready' ? [...watchlistSymbols] : []}
        onOpenCompany={company => openIntelModal({ scripCode: company.scripCode, symbol: company.symbol, companyName: company.name })}
        onOpenStory={() => { setSelectedStoryChapter(undefined); setStoryModalOpen(true); }} />}
      <ImpactRadar key={identity} active={isActive} identity={identity} onNavigate={onNavigate} density={density} watched={sameIdentity && watchlistStatus==='ready' ? [...watchlistSymbols] : []} watchlistStatus={sameIdentity ? watchlistStatus : 'loading'} onRefreshWatchlist={() => setHomeRefresh(v => v + 1)} />
      <HomeMarketNews key={`news-${identity}`} watchlistOnly watchlistStatus={sameIdentity ? watchlistStatus : 'loading'} active={isActive} identity={identity} watched={personalTerms} onNavigate={onNavigate} density={density} />

      {/* Add Companies Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overscroll-contain">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs overscroll-contain"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={springSnappy}
              {...addDialog}
              aria-label="Add company to watchlist"
              className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white dark:bg-[#181624] rounded-2xl border border-slate-200 dark:border-[#262335] shadow-2xl p-5 space-y-4 z-10 overscroll-contain"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#262335] pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                    Add company to watchlist
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Track earnings dates, filings, and news
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close add company"
                  onClick={() => setIsAddModalOpen(false)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold" htmlFor="home-watchlist-target">Add to watchlist</label>
                <select id="home-watchlist-target" value={watchlists.length ? targetListId : 'new'} disabled={!!addingStock || watchlistStatus!=='ready'} onChange={event=>{setTargetListId(event.target.value);setAddError('');setAddSuccess('');}} className="w-full min-h-11 border rounded-xl px-3 bg-white dark:bg-slate-900 text-sm">
                  {watchlists.map(list=><option key={list.id} value={String(list.id)}>{list.name}{list.is_active===false||list.is_active===0?' (inactive)':''}</option>)}
                  <option value="new">+ Create new watchlist</option>
                </select>
                {(targetListId==='new'||!watchlists.length) && <input aria-label="New watchlist name" value={newWatchlistName} maxLength={60} disabled={!!addingStock} onChange={event=>setNewWatchlistName(event.target.value)} placeholder="New watchlist name" className="w-full min-h-11 border rounded-xl px-3 bg-white dark:bg-slate-900 text-base"/>}
                {addError && <p role="alert" className="text-xs text-rose-600 dark:text-rose-300">{addError}</p>}
                {addSuccess && <p role="status" className="text-xs text-emerald-700 dark:text-emerald-300">{addSuccess}</p>}
              </div>
              {/* Search input */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={e => setModalSearch(e.target.value)}
                  aria-label="Find stock to add"
                  placeholder="Search any company or symbol"
                  className="w-full h-10 pl-9 pr-3 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-900 dark:text-white"
                />
              </div>

              {/* Quick Starter Picks */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {searching ? 'Searching…' : modalSearch.trim() ? 'Search results' : 'Popular Indian Companies'}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {filteredStarterStocks.map(stk => {
                    const isTracked = selectedStocks.has(stk.symbol.toUpperCase()) || selectedStocks.has(stk.scripCode);
                    const isBusy = addingStock === stk.symbol;

                    return (
                      <div
                        key={stk.symbol}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#201E2E] border border-slate-200/80 dark:border-[#2D283E] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {stk.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {stk.symbol} &bull; BSE {stk.scripCode}
                          </div>
                        </div>

                        <ActionButton
                          onClick={() => handleAddStock(stk.symbol, stk.scripCode, stk.name)}
                          isLoading={isBusy}
                          loadingText="Adding..."
                          disabled={isTracked || !!addingStock || watchlistStatus!=='ready' || ((targetListId==='new'||!watchlists.length) && !newWatchlistName.trim())}
                          variant={isTracked ? "secondary" : "primary"}
                          size="sm"
                          className={cn(
                            "min-h-[36px] shrink-0 text-xs font-bold",
                            isTracked && "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                          )}
                          icon={isTracked ? <Check size={13} className="text-emerald-600" /> : <Plus size={13} />}
                        >
                          {isTracked ? 'Added' : 'Add'}
                        </ActionButton>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom footer button to full watchlist */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#262335] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    onNavigate('watchlists');
                  }}
                  className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer flex items-center gap-1"
                >
                  <span>Manage full watchlist</span>
                  <ArrowRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="min-h-[36px] px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Filing Detail Bottom Sheet */}
      <AnimatePresence>
        {sameIdentity && selectedFiling && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFiling(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs overscroll-contain"
            />
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={springSnappy}
              {...filingDialog}
              aria-label="Filing details"
              className="relative w-full sm:max-w-lg bg-white dark:bg-[#181624] rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-[#262335] shadow-2xl p-5 max-h-[85vh] overflow-y-auto overscroll-contain space-y-4 z-10 safe-area-bottom"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-[#262335] pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                    {selectedFiling.companyName}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    BSE Scrip {selectedFiling.scrip_cd} &bull; {formatFilingRelativeTime(selectedFiling.bseTimestamp || selectedFiling.fetched_at || Date.now())}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFiling(null)}
                  aria-label="Close filing details"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Subject
                </div>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-[#201E2E] p-3 rounded-xl border border-slate-200/80 dark:border-[#2D283E]">
                  {cleanBseSubject(selectedFiling.subject || selectedFiling.details || '').headline || selectedFiling.subject || selectedFiling.details || 'No subject details provided'}
                </p>
              </div>

              {/* Action */}
              <div className="pt-2 flex items-center gap-2">
                {selectedFiling.attachment || selectedFiling.pdf_link ? (
                  <a
                    href={getSafePdfUrl(selectedFiling.attachment || selectedFiling.pdf_link)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex-1 min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <FileText size={14} />
                    <span>Open Official BSE Document (PDF)</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedFiling(null)}
                    className="w-full min-h-[44px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold"
                  >
                    Close
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Result Detail Bottom Sheet */}
      <AnimatePresence>
        {sameIdentity && selectedResult && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedResult(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs overscroll-contain"
            />
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={springSnappy}
              {...resultDialog}
              aria-label="Result details"
              className="relative w-full sm:max-w-lg bg-white dark:bg-[#181624] rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-[#262335] shadow-2xl p-5 max-h-[85vh] overflow-y-auto overscroll-contain space-y-4 z-10 safe-area-bottom"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-[#262335] pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                    {selectedResult.companyName}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedResult.isDeclared === true ? 'Result declared' : 'Board meeting'} · {selectedResult.meetingDate}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedResult(null)}
                  aria-label="Close result details"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Meeting Purpose
                </div>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-[#201E2E] p-3 rounded-xl border border-slate-200/80 dark:border-[#2D283E]">
                  {selectedResult.purpose || 'Financial Results & Corporate Review'}
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedResult(null);
                    onNavigate('results-calendar');
                  }}
                  className="flex-1 min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CalendarDays size={14} />
                  <span>Open Earnings calendar</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Groww-Style Market Story Viewer Modal */}
      {storyModalOpen && (
        <TodayMarketStoryModal watched={personalTerms}
          isOpen={storyModalOpen}
          initialChapterId={selectedStoryChapter}
          onClose={() => {
            setStoryModalOpen(false);
            setSelectedStoryChapter(undefined);
          }}
          onOpenCompanyIntel={(scripCode, symbol, companyName) => {
            openIntelModal({ scripCode, symbol, companyName });
          }}
        />
      )}

    </div>
  );
}
