import React, { useState, useEffect, useRef } from 'react';
import { 
  X, ShieldAlert, Plus, ToggleLeft, ToggleRight, Trash2, 
  CheckCircle2, Sparkles, Filter, Bell, Send, Edit3, 
  Check, ChevronRight, HelpCircle, Layers, Coins, Award, BarChart3,
  TrendingUp, Activity, FileText, CheckCheck, SlidersHorizontal
} from 'lucide-react';
import { customFetch } from '../api';
import { useAuth } from '../context/AuthContext';
import { DeviceNotificationControl } from './DeviceNotificationControl';
import { Switch } from './ui/Switch';
import { presetKeyOf, presetsFromRules } from '../shared/alertRules';
import type { AlertRule } from '../shared/alertRules';
export type { AlertRule } from '../shared/alertRules';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { ActionButton } from './ui/ActionButton';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function AlertRuleSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div 
          key={i} 
          className="p-3.5 rounded-xl border border-slate-200/80 dark:border-[#2D283E] bg-white/50 dark:bg-[#1E1C2B]/50 flex items-start justify-between gap-3"
        >
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700/60 rounded" />
              <div className="h-3.5 w-16 bg-slate-100 dark:bg-slate-800 rounded-full" />
            </div>
            <div className="h-3 w-48 bg-slate-100 dark:bg-slate-800/80 rounded" />
            <div className="flex items-center gap-2 pt-1">
              <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 rounded" />
              <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
            </div>
          </div>
          <div className="h-6 w-10 bg-slate-200 dark:bg-slate-700/60 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

interface AlertRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AlertRulesModal({ isOpen, onClose }: AlertRulesModalProps) {
  useBodyScrollLock(isOpen);
  const { user } = useAuth();
  const uid = user?.uid || '';
  const identity = useRef(uid); identity.current = uid;
  const session = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const draftId = useRef<string | null>(null);
  const [editingId,setEditingId] = useState<string | null>(null);
  const [error,setError] = useState<string | null>(null);
  const [loaded,setLoaded] = useState(false);


  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Preset quick states
  const [presetResults, setPresetResults] = useState<boolean>(true);
  const [presetCorpActions, setPresetCorpActions] = useState<boolean>(true);
  const [presetMaterial, setPresetMaterial] = useState<boolean>(true);
  const [presetScope, setPresetScope] = useState<'watchlist' | 'all'>('watchlist');
  const [presetInApp, setPresetInApp] = useState<boolean>(true);
  const [presetTelegram, setPresetTelegram] = useState<boolean>(true);
  const [presetSavedFeedback, setPresetSavedFeedback] = useState<string | null>(null);

  // New Rule Form State
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<AlertRule['category']>('RESULTS');
  const [priority, setPriority] = useState<'HIGH_ONLY' | 'MEDIUM_HIGH' | 'ALL'>('HIGH_ONLY');
  const [scope, setScope] = useState<'ALL_STOCKS' | 'WATCHLIST_ONLY' | 'SPECIFIC_SYMBOLS'>('WATCHLIST_ONLY');
  const [symbolsInput, setSymbolsInput] = useState<string>('');
  const [keywordsInput, setKeywordsInput] = useState<string>('');
  const [excludeKeywordsInput, setExcludeKeywordsInput] = useState<string>('');
  const [inApp, setInApp] = useState<boolean>(true);
  const [telegram, setTelegram] = useState<boolean>(true);

  const confirmedPresets = presetsFromRules(rules);
  const presetDirty = loaded && (presetResults !== confirmedPresets.results || presetCorpActions !== confirmedPresets.corporate || presetMaterial !== confirmedPresets.material || (presetScope === 'all' ? 'ALL_STOCKS' : 'WATCHLIST_ONLY') !== confirmedPresets.scope || presetInApp !== confirmedPresets.channels.inApp || presetTelegram !== confirmedPresets.channels.telegram);

  const applyRules = (loadedRules: AlertRule[]) => {
    setRules(loadedRules);
    const p=presetsFromRules(loadedRules);
    setPresetResults(p.results); setPresetCorpActions(p.corporate); setPresetMaterial(p.material);
    setPresetScope(p.scope==='ALL_STOCKS'?'all':'watchlist');
    setPresetInApp(p.channels.inApp); setPresetTelegram(p.channels.telegram);
  };
  const request = async (url:string, options:RequestInit={}) => {
    const controller = new AbortController(); pending.current=controller;
    const timer=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await customFetch(url,{...options,cache:'no-store',signal:controller.signal});
      const data=await response.json();
      if(!response.ok||data.success===false)throw new Error(data.error||'Unable to save alerts. Please retry.');
      return data;
    } finally {clearTimeout(timer);if(pending.current===controller)pending.current=null;}
  };
  const loadRules = async () => {
    const version=session.current, owner=uid;
    setLoading(true);setError(null);
    try {
      if(!owner)throw new Error('Sign in to manage alerts.');
      const data=await request('/api/alert-rules');
      if(!Array.isArray(data.rules))throw new Error('Invalid alert response. Please retry.');
      if(version!==session.current||owner!==identity.current)return;
      applyRules(data.rules);setLoaded(true);
    } catch(e:any) {
      if(version===session.current&&owner===identity.current)setError(e.name==='AbortError'?'Loading timed out. Please retry.':e.message);
    } finally {if(version===session.current&&owner===identity.current)setLoading(false);}
  };
  useEffect(() => {
    session.current++;busy.current=false;setSaving(false);setLoaded(false);setRules([]);setIsCreating(false);setPresetSavedFeedback(null);resetForm();
    if(isOpen)void loadRules();
    return ()=>{session.current++;pending.current?.abort();};
  },[isOpen,uid]);
  const mutate = async (run:()=>Promise<any>, onSuccess:(data:any)=>void) => {
    if(busy.current||!loaded)return;
    busy.current=true;setSaving(true);setError(null);setPresetSavedFeedback(null);
    const version=session.current,owner=uid;
    try {
      const data=await run();
      if(version===session.current&&owner===identity.current)onSuccess(data);
    } catch(e:any) {
      if(version===session.current&&owner===identity.current)setError(e.name==='AbortError'?'Save timed out; its outcome is unconfirmed. Retry safely or reopen to check.':e.message);
    } finally {if(version===session.current&&owner===identity.current){busy.current=false;setSaving(false);}}
  };
  const handleToggle = (id:string,currentEnabled:boolean) => mutate(
    ()=>request(`/api/alert-rules/${encodeURIComponent(id)}/toggle`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:!currentEnabled})}),
    ()=>setRules(prev=>prev.map(r=>r.id===id?{...r,enabled:!currentEnabled}:r)));
  const handleDelete = (id:string) => {
    if(!confirm('Are you sure you want to delete this alert rule?'))return;
    void mutate(()=>request(`/api/alert-rules/${encodeURIComponent(id)}`,{method:'DELETE'}),()=>setRules(prev=>prev.filter(r=>r.id!==id)));
  };
  const handleSavePresets = () => mutate(()=>request('/api/alert-rules/presets',{
    method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({results:presetResults,corporate:presetCorpActions,material:presetMaterial,scope:presetScope==='watchlist'?'WATCHLIST_ONLY':'ALL_STOCKS',channels:{inApp:presetInApp,telegram:presetTelegram}})
  }),data=>{
    if(!Array.isArray(data.rules)||data.rules.length!==3)throw new Error('Preset save could not be confirmed. Reopen to check.');
    applyRules([...rules.filter(r=>!presetKeyOf(r)),...data.rules]);setPresetSavedFeedback('Alert presets saved.');
  });
  const handleSaveRule = (e:React.FormEvent) => {
    e.preventDefault();
    if(!draftId.current)draftId.current=editingId || `rule_${crypto.randomUUID()}`;
    void mutate(()=>request('/api/alert-rules',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      id:draftId.current,name:name.trim(),description:description.trim(),enabled:editingId?rules.find(r=>r.id===editingId)?.enabled??true:true,category,priority,scope,
      symbols:symbolsInput.split(',').map(s=>s.trim().toUpperCase()).filter(Boolean),keywords:keywordsInput.split(',').map(k=>k.trim().toLowerCase()).filter(Boolean),excludeKeywords:excludeKeywordsInput.split(',').map(k=>k.trim().toLowerCase()).filter(Boolean),channels:{inApp,telegram}
    })}),data=>{
      if(!data.rule?.id)throw new Error('Rule save could not be confirmed. Reopen to check.');
      setRules(prev=>[...prev.filter(r=>r.id!==data.rule.id),data.rule]);setIsCreating(false);resetForm();
    });
  };
  const handleEdit = (rule:AlertRule) => {
    setEditingId(rule.id);draftId.current=rule.id;setName(rule.name);setDescription(rule.description||'');setCategory(rule.category);setPriority(rule.priority);setScope(rule.scope);setSymbolsInput(rule.symbols.join(', '));setKeywordsInput(rule.keywords.join(', '));setExcludeKeywordsInput(rule.excludeKeywords.join(', '));setInApp(rule.channels.inApp);setTelegram(rule.channels.telegram);setIsCreating(true);
  };
  const customRules = rules.filter(r=>!presetKeyOf(r));

  const resetForm = () => {
    draftId.current=null;setEditingId(null);
    setName('');
    setDescription('');
    setCategory('RESULTS');
    setPriority('HIGH_ONLY');
    setScope('WATCHLIST_ONLY');
    setSymbolsInput('');
    setKeywordsInput('');
    setExcludeKeywordsInput('');
    setInApp(true);
    setTelegram(true);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 overscroll-contain"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-rules-title"
    >
      <div 
        className="alert-rules-sheet bg-white dark:bg-[#1A1926] border border-slate-200 dark:border-[#2D283E] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#2D283E] bg-slate-50/80 dark:bg-[#15141F] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs">
              <Bell size={17} />
            </div>
            <div>
              <h2 id="alert-rules-title" className="text-base font-extrabold text-slate-900 dark:text-white font-display">
                Alerts &amp; Notifications
              </h2>
              <p className="text-xs text-slate-500">
                Choose presets for normal use, or create custom alert rules
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close alerts settings"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher: Presets vs Custom Alerts */}
        <div className="flex border-b border-slate-200/80 dark:border-[#2D283E] bg-slate-100/60 dark:bg-[#181624] px-4 pt-2 gap-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('presets');
              setIsCreating(false);
            }}
            className={cn(
              "pb-2.5 transition-all cursor-pointer relative",
              activeTab === 'presets'
                ? "text-slate-900 dark:text-white font-black"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <span>Alert Presets</span>
            {activeTab === 'presets' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 dark:bg-white rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={cn(
              "pb-2.5 transition-all cursor-pointer relative flex items-center gap-1.5",
              activeTab === 'custom'
                ? "text-slate-900 dark:text-white font-black"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <span>Custom Alerts</span>
            {customRules.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-[#2D283E] text-slate-700 dark:text-slate-300">
                {customRules.length}
              </span>
            )}
            {activeTab === 'custom' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 dark:bg-white rounded-full" />
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 overscroll-contain">
          {error && <div role="alert" className="text-sm text-rose-600">{error}{!loaded && <button type="button" onClick={()=>void loadRules()} disabled={loading} className="ml-2 underline">Try again</button>}</div>}
          <DeviceNotificationControl />
          {loading && <AlertRuleSkeleton />}
          <fieldset disabled={saving || loading || !loaded} className="min-w-0" onChange={()=>setPresetSavedFeedback(null)} onClick={()=>setPresetSavedFeedback(null)}>
          
          {/* TAB 1: PRESETS FOR NORMAL USERS */}
          {activeTab === 'presets' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Choose filing categories, then save your inbox and Telegram rules.
              </div>

              {/* Preset 1: Results */}
              <div className="p-3.5 rounded-xl border border-slate-200/90 dark:border-[#2D283E] bg-slate-50/60 dark:bg-[#161522] flex items-center justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="alert-preset-heading">
                    <div className="p-1 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                      <TrendingUp size={14} />
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Financial Results
                    </span>
                    <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/80 whitespace-nowrap select-none">
                      Results
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Quarterly &amp; Annual financial results, Board meeting outcomes, and revenue/profit figures.
                  </p>
                </div>
                <Switch checked={presetResults} onChange={setPresetResults} label="Financial Results" />
              </div>

              {/* Preset 2: Corporate Actions */}
              <div className="p-3.5 rounded-xl border border-slate-200/90 dark:border-[#2D283E] bg-slate-50/60 dark:bg-[#161522] flex items-center justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="alert-preset-heading">
                    <div className="p-1 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                      <Coins size={14} />
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Corporate Actions
                    </span>
                    <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/80 whitespace-nowrap select-none">
                      Dividends &amp; Splits
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Dividends, Bonus issues, Stock splits, Rights issues, and Share buybacks.
                  </p>
                </div>
                <Switch checked={presetCorpActions} onChange={setPresetCorpActions} label="Corporate Actions" />
              </div>

              {/* Preset 3: All Material Updates */}
              <div className="p-3.5 rounded-xl border border-slate-200/90 dark:border-[#2D283E] bg-slate-50/60 dark:bg-[#161522] flex items-center justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="alert-preset-heading">
                    <div className="p-1 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300">
                      <Activity size={14} />
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      All Material Updates
                    </span>
                    <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/80 whitespace-nowrap select-none">
                      SEBI LODR Reg 30
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    High impact disclosures: Order wins, M&amp;A, Capex, Credit ratings &amp; Management changes.
                  </p>
                </div>
                <Switch checked={presetMaterial} onChange={setPresetMaterial} label="All Material Updates" />
              </div>

              {/* Channels & Scope Preferences */}
              <div className="p-3 bg-slate-50 dark:bg-[#15141E] border border-slate-200 dark:border-[#2D283E] rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Scope:</span>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setPresetScope('watchlist')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer border",
                        presetScope === 'watchlist'
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent"
                          : "bg-white dark:bg-[#1E1C2B] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                      )}
                    >
                      My Watchlist Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetScope('all')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer border",
                        presetScope === 'all'
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent"
                          : "bg-white dark:bg-[#1E1C2B] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                      )}
                    >
                      All BSE Listed
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-[#2D283E]">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Channels:</span>
                  <div className="flex items-center gap-4 text-xs font-bold">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={presetInApp}
                        onChange={(e) => setPresetInApp(e.target.checked)}
                        className="rounded text-slate-900 dark:text-white"
                      />
                      <span>In-App Inbox</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={presetTelegram}
                        onChange={(e) => setPresetTelegram(e.target.checked)}
                        className="rounded text-slate-900 dark:text-white"
                      />
                      <span>Telegram</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Save Presets Action */}
              <div className="flex items-center justify-between pt-2">
                {presetSavedFeedback ? (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    {presetSavedFeedback}
                  </span>
                ) : <div />}

                <ActionButton
                  type="button"
                  onClick={handleSavePresets}
                  isLoading={saving}
                  loadingText="Saving..."
                  variant="primary"
                  size="md"
                  icon={presetSavedFeedback ? <Check size={13} className="text-emerald-300" /> : undefined}
                >
                  {presetSavedFeedback ? 'Saved!' : 'Save Presets'}
                </ActionButton>
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOM ALERTS FOR POWER USERS */}
          {activeTab === 'custom' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {isCreating ? (
                /* CREATE RULE FORM */
                <form onSubmit={handleSaveRule} className="space-y-4">
                  <div className="p-3 bg-slate-100 dark:bg-[#1E1C2B] border border-slate-200 dark:border-[#2D283E] rounded-xl text-xs flex items-center justify-between text-slate-800 dark:text-slate-200">
                    <span className="font-bold">Define Custom Surveillance Filter</span>
                    <button 
                      type="button" 
                      onClick={() => setIsCreating(false)} 
                      className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Rule Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. EV Battery Capex & Contracts"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-[#15141F] border border-slate-200 dark:border-[#2D283E] rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-hidden focus:ring-1 focus:ring-slate-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Event Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as any)}
                        className="w-full bg-slate-50 dark:bg-[#15141F] border border-slate-200 dark:border-[#2D283E] rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-hidden"
                      >
                        <option value="RESULTS">Quarterly &amp; Annual Results</option>
                        <option value="DIVIDEND">Dividends, Bonus &amp; Splits</option>
                        <option value="BUYBACK">Share Buybacks &amp; Open Offers</option>
                        <option value="ORDER_WIN">Order Wins &amp; Contracts</option>
                        <option value="BOARD_MEETING">Board Meeting Intimations</option>
                        <option value="ALL">All Categories</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Stock Scope</label>
                      <select
                        value={scope}
                        onChange={(e) => setScope(e.target.value as any)}
                        className="w-full bg-slate-50 dark:bg-[#15141F] border border-slate-200 dark:border-[#2D283E] rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-hidden"
                      >
                        <option value="WATCHLIST_ONLY">Watchlist Stocks Only</option>
                        <option value="ALL_STOCKS">All BSE Listed Stocks</option>
                        <option value="SPECIFIC_SYMBOLS">Specific Tickers / Scrip Codes</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Priority Filter</label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as any)}
                        className="w-full bg-slate-50 dark:bg-[#15141F] border border-slate-200 dark:border-[#2D283E] rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-hidden"
                      >
                        <option value="HIGH_ONLY">High Impact Only</option>
                        <option value="MEDIUM_HIGH">High + Medium Impact</option>
                        <option value="ALL">All Filings</option>
                      </select>
                    </div>
                  </div>

                  {scope === 'SPECIFIC_SYMBOLS' && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Specific Symbols (Comma-separated)</label>
                      <input
                        type="text"
                        placeholder="e.g. RELIANCE, TCS, 500325, INFY"
                        value={symbolsInput}
                        onChange={(e) => setSymbolsInput(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-[#15141F] border border-slate-200 dark:border-[#2D283E] rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white outline-hidden"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Required Keywords (Comma-separated)</label>
                      <input
                        type="text"
                        placeholder="e.g. battery, solar, capex, expansion"
                        value={keywordsInput}
                        onChange={(e) => setKeywordsInput(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-[#15141F] border border-slate-200 dark:border-[#2D283E] rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-hidden"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Exclude Keywords (Anti-Noise)</label>
                      <input
                        type="text"
                        placeholder="e.g. loss of share, duplicate, scrutinizer"
                        value={excludeKeywordsInput}
                        onChange={(e) => setExcludeKeywordsInput(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-[#15141F] border border-slate-200 dark:border-[#2D283E] rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Delivery Channels */}
                  <div className="p-3 bg-slate-50 dark:bg-[#15141F] border border-slate-200 dark:border-[#2D283E] rounded-xl space-y-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Dispatch Channels</span>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inApp}
                          onChange={(e) => setInApp(e.target.checked)}
                          className="rounded text-slate-900 dark:text-white focus:ring-slate-400 w-4 h-4"
                        />
                        <Bell size={14} className="text-slate-600 dark:text-slate-300" />
                        <span>In-App Notification Inbox</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={telegram}
                          onChange={(e) => setTelegram(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <Send size={14} className="text-blue-500" />
                        <span>Telegram Channel Alert</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <ActionButton
                      type="submit"
                      isLoading={saving}
                      loadingText="Saving..."
                      variant="primary"
                      size="md"
                      disabled={!name.trim()}
                    >
                      {editingId ? 'Save Rule' : 'Create & Activate Rule'}
                    </ActionButton>
                  </div>
                </form>
              ) : (
                /* RULES LIST */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Custom alert rules evaluate 100% of live BSE filings:</span>
                    <button
                      type="button"
                      onClick={() => {resetForm();setIsCreating(true);}}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>New Custom Rule</span>
                    </button>
                  </div>

                  {loading ? (
                    <AlertRuleSkeleton />
                  ) : customRules.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 space-y-2 bg-slate-50 dark:bg-[#15141F] rounded-xl border border-slate-200 dark:border-[#2D283E]">
                      <p>No custom alert rules configured yet.</p>
                      <button
                        type="button"
                        onClick={() => {resetForm();setIsCreating(true);}}
                        className="px-3.5 py-1.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold rounded-lg text-xs cursor-pointer"
                      >
                        Add your first custom alert rule
                      </button>
                    </div>
                  ) : (
                    customRules.map((rule) => {
                      const isResult = rule.category === 'RESULTS';
                      const isDiv = rule.category === 'DIVIDEND';
                      const isOrder = rule.category === 'ORDER_WIN';
                      const isBuyback = rule.category === 'BUYBACK';

                      return (
                        <div
                          key={rule.id}
                          className={cn(
                            "p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3",
                            rule.enabled
                              ? "bg-white dark:bg-[#1E1C2B] border-slate-200/90 dark:border-[#2D283E] shadow-2xs"
                              : "bg-slate-50 dark:bg-[#15141F] border-slate-200/60 dark:border-[#2D283E]/60 opacity-60"
                          )}
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                                {rule.name}
                              </span>
                              <span className={cn(
                                "text-[9px] font-bold uppercase px-2 py-0.2 rounded-full",
                                isResult ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                                isDiv ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" :
                                isOrder ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300" :
                                "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              )}>
                                {rule.category}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-[#252233] text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-[#352F48]">
                                {rule.scope === 'WATCHLIST_ONLY' ? 'Watchlist' : rule.scope === 'ALL_STOCKS' ? 'All BSE' : 'Custom Tickers'}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              {rule.description}
                            </p>

                            <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap pt-0.5">
                              <div className="flex items-center gap-1">
                                <span>Channels:</span>
                                {rule.channels?.inApp && <span className="text-emerald-600 font-bold">In-App</span>}
                                {rule.channels?.inApp && rule.channels?.telegram && <span>+</span>}
                                {rule.channels?.telegram && <span className="text-blue-600 font-bold">Telegram</span>}
                              </div>

                              {rule.keywords?.length > 0 && (
                                <div className="text-slate-500 font-mono text-[10px]">
                                  Keywords: {rule.keywords.slice(0, 3).join(', ')}{rule.keywords.length > 3 ? '...' : ''}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button type="button" onClick={()=>handleEdit(rule)} aria-label={`Edit ${rule.name}`} className="p-1.5"><Edit3 size={16} /></button>
                            <Switch checked={rule.enabled} onChange={() => handleToggle(rule.id, rule.enabled)} label={`Enable ${rule.name}`} disabled={saving} />

                            <button
                              type="button"
                              onClick={() => handleDelete(rule.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Delete Rule"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
          </fieldset>
        </div>

        {/* Footer */}
        <div className="alert-rules-footer p-3.5 border-t border-slate-100 dark:border-[#2D283E] bg-slate-50/80 dark:bg-[#15141F] flex items-center justify-between text-xs text-slate-500">
          <span role="status">{activeTab === 'presets' && presetDirty ? 'Unsaved changes. Save to apply your alert rules.' : 'Device notifications and inbox rules are managed separately.'}</span>
          <button
            type="button"
            onClick={() => { if (activeTab === 'presets' && presetDirty) void handleSavePresets(); else onClose(); }}
            disabled={saving}
            className="px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-lg text-xs hover:opacity-90 transition-opacity cursor-pointer"
          >
            {saving ? 'Saving…' : activeTab === 'presets' && presetDirty ? 'Save changes' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}
