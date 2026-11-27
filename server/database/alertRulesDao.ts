import { createHash, randomUUID } from 'node:crypto';
import { getSupabase, isSupabaseConfigured } from './supabase.js';
import { readLocalJson, writeLocalJson } from './localStore.js';
import { isSymbolMatch } from '../utils/helpers.js';
import { effectiveAlertRules, presetKeyOf, presetsFromRules, makePresetRules, DEFAULT_ALERT_PRESETS, PRESET_NAMES } from '../../src/shared/alertRules.js';
import type { AlertRule, AlertPresets, PresetKey } from '../../src/shared/alertRules.js';
export type { AlertRule } from '../../src/shared/alertRules.js';
const ALERT_RULES_FILE = 'alert_rules.json';
const DEFAULT_PRESET_RULES: AlertRule[] = [
  {
    id: 'preset_results',
    name: 'Quarterly & Annual Financial Results',
    description: 'Instant notification on audited/unaudited quarterly financial result filings',
    enabled: true,
    category: 'RESULTS',
    priority: 'HIGH_ONLY',
    scope: 'WATCHLIST_ONLY',
    symbols: [],
    keywords: ['financial result', 'audited', 'unaudited', 'quarterly result'],
    excludeKeywords: ['newspaper publication'],
    channels: { inApp: true, telegram: true },
    userId: 'system',
    createdAt: Date.now()
  },
  {
    id: 'preset_dividends',
    name: 'Dividends, Bonus & Stock Splits',
    description: 'Detects interim/final dividends, bonus issues, and share splits',
    enabled: true,
    category: 'DIVIDEND',
    priority: 'HIGH_ONLY',
    scope: 'WATCHLIST_ONLY',
    symbols: [],
    keywords: ['dividend', 'bonus', 'split', 'sub-division', 'record date'],
    excludeKeywords: [],
    channels: { inApp: true, telegram: true },
    userId: 'system',
    createdAt: Date.now()
  },
  {
    id: 'preset_buybacks',
    name: 'Share Buybacks & Open Offers',
    description: 'Capital restructuring, buyback proposals, tender offers & acceptances',
    enabled: true,
    category: 'BUYBACK',
    priority: 'HIGH_ONLY',
    scope: 'ALL_STOCKS',
    symbols: [],
    keywords: ['buyback', 'buy-back', 'open offer', 'delisting', 'tender offer'],
    excludeKeywords: [],
    channels: { inApp: true, telegram: false },
    userId: 'system',
    createdAt: Date.now()
  },
  {
    id: 'preset_order_wins',
    name: 'Major Order Wins & Commercial Contracts',
    description: 'Significant commercial orders, contracts, tenders, and agreements',
    enabled: true,
    category: 'ORDER_WIN',
    priority: 'MEDIUM_HIGH',
    scope: 'WATCHLIST_ONLY',
    symbols: [],
    keywords: ['order win', 'bagged order', 'contract', 'agreement', 'commercial pact', 'work order'],
    excludeKeywords: [],
    channels: { inApp: true, telegram: true },
    userId: 'system',
    createdAt: Date.now()
  }
];

let rulesCache: AlertRule[] = readLocalJson<AlertRule[]>(ALERT_RULES_FILE, []).filter(r=>r.userId!=='system');
export class AlertRuleError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const durable = () => isSupabaseConfigured() || process.env.NODE_ENV === 'production';
async function cloud<T>(run:()=>PromiseLike<{data:T;error:any}>): Promise<T> {
  try { const {data,error}=await run(); if(error) throw error; return data; }
  catch { throw new AlertRuleError(503,'Alert storage is unavailable. The operation was not confirmed. Retry safely.'); }
}
function presetId(uid:string,key:PresetKey) {return `preset_${createHash('sha256').update(uid).digest('hex')}_${key}`;}
function view(rows:AlertRule[],uid:string) {
  if(uid==='system') return DEFAULT_PRESET_RULES;
  const own=effectiveAlertRules(rows,uid);
  if(!own.some(r=>presetKeyOf(r))) return [...own,...makePresetRules(uid,DEFAULT_ALERT_PRESETS,k=>presetId(uid,k),0)];
  return own;
}
export async function getAllAlertRules(uid='guest'):Promise<AlertRule[]> {
  if(uid==='guest') return [];
  if(!durable()) return view(rulesCache,uid);
  return view(await readCloudRules(uid),uid);
}
// Refresh once per poll, before processing/marking any filing. Replace instead of merging:
// deletions and saves from other instances must take effect too.
async function readCloudRules(uid?: string): Promise<AlertRule[]> {
  const all: AlertRule[] = [];
  for (let offset = 0; ; offset += 1000) {
    if (!isSupabaseConfigured()) throw new AlertRuleError(503, 'Alert storage is not configured.');
    let query = getSupabase().from('alert_rules').select('id,user_id,rule').order('id');
    if (uid) query = query.eq('user_id', uid);
    const rows = await cloud<any[]>(() => query.range(offset, offset + 999).abortSignal(AbortSignal.timeout(10000)));
    all.push(...(rows || []).map(r => ({ ...r.rule, id: r.id, userId: r.user_id })));
    if (!rows || rows.length < 1000) break;
  }
  return all;
}
// Poll-cycle rules cache: the monitor refreshes alert rules once per cycle
// (15s-60s), which used to mean a full alert_rules table read every cycle.
// Serve the in-memory snapshot and re-read only at boot, after the 15-min
// safety TTL, or after a same-instance write invalidates it (all writes pass
// through this DAO, so local edits stay instantly correct; cross-instance
// edits lag at most one TTL). A store outage (e.g. Supabase quota
// restriction) degrades to the last-known rules and logs once per episode —
// it must never abort the cycle before filing-save. Write paths and
// per-user reads still fail visibly with 503.
const RULES_CACHE_TTL_MS = 15 * 60 * 1000;
let rulesCacheLoadedAt = 0;
let alertRulesCloudFallbackLogged = false;
function invalidateRulesCache() { rulesCacheLoadedAt = 0; }
export async function initAlertRulesFromCloud(): Promise<AlertRule[]> {
  if (!durable()) return [...rulesCache];
  if (rulesCacheLoadedAt > 0 && Date.now() - rulesCacheLoadedAt < RULES_CACHE_TTL_MS) {
    return [...rulesCache];
  }
  try {
    rulesCache = await readCloudRules();
    rulesCacheLoadedAt = Date.now();
    alertRulesCloudFallbackLogged = false;
    return [...rulesCache];
  } catch (err: any) {
    if (!alertRulesCloudFallbackLogged) {
      alertRulesCloudFallbackLogged = true;
      console.warn('[AlertRules] Cloud refresh failed; serving last-known rules until the store recovers:', err?.message || err);
    }
    return [...rulesCache];
  }
}
function requireOwner(uid:string) {if(!uid||uid==='guest'||uid==='system')throw new AlertRuleError(401,'Sign in to manage alerts.');}
function validate(rule:any):void {
  if(!rule||typeof rule.name!=='string'||!rule.name.trim()||rule.name.length>100)throw new AlertRuleError(400,'Enter a rule name of 1–100 characters.');
  if(!['ALL','RESULTS','DIVIDEND','BUYBACK','BONUS_SPLIT','ORDER_WIN','BOARD_MEETING','GOVERNANCE'].includes(rule.category)
    ||!['ALL','HIGH_ONLY','MEDIUM_HIGH'].includes(rule.priority)
    ||!['ALL_STOCKS','WATCHLIST_ONLY','SPECIFIC_SYMBOLS'].includes(rule.scope)
    ||typeof rule.enabled!=='boolean')throw new AlertRuleError(400,'Invalid alert category, priority, scope or enabled state.');
  for(const key of ['symbols','keywords','excludeKeywords'])if(!Array.isArray(rule[key])||rule[key].length>100||rule[key].some((v:any)=>typeof v!=='string'||v.length>100))throw new AlertRuleError(400,'Invalid symbols or keywords.');
  if(rule.scope==='SPECIFIC_SYMBOLS'&&!rule.symbols.some((s:string)=>s.trim()))throw new AlertRuleError(400,'Enter at least one ticker or BSE scrip code.');
  if(!rule.channels||typeof rule.channels.inApp!=='boolean'||typeof rule.channels.telegram!=='boolean')throw new AlertRuleError(400,'Select valid delivery channels.');
}
export async function saveAlertPresets(values:AlertPresets,uid:string):Promise<AlertRule[]> {
  requireOwner(uid);
  if(!values||['results','corporate','material'].some(k=>typeof values[k as PresetKey]!=='boolean')||!['WATCHLIST_ONLY','ALL_STOCKS'].includes(values.scope)||typeof values.channels?.inApp!=='boolean'||typeof values.channels?.telegram!=='boolean')throw new AlertRuleError(400,'Invalid alert preset settings.');
  const rules=makePresetRules(uid,values,k=>presetId(uid,k));
  if(durable()) {
    // One bulk SQL statement: all three presets commit together; stable IDs make retries safe.
    await cloud(()=>getSupabase().from('alert_rules').upsert(rules.map(rule=>({id:rule.id,user_id:uid,rule})),{onConflict:'id'}).select('id').abortSignal(AbortSignal.timeout(10000)));
    invalidateRulesCache();
  } else { rulesCache=[...rulesCache.filter(r=>!rules.some(n=>n.id===r.id)),...rules];writeLocalJson(ALERT_RULES_FILE,rulesCache); }
  return rules;
}
export async function saveAlertRule(input:any,uid='guest'):Promise<AlertRule> {
  requireOwner(uid); validate(input);
  if(input.presetKey||Object.values(PRESET_NAMES).includes(input.name.trim()))throw new AlertRuleError(400,'Use Save Presets to update presets.');
  const id=input.id || `rule_${randomUUID()}`;
  if(typeof id!=='string'||!/^rule_[a-zA-Z0-9_-]{1,100}$/.test(id))throw new AlertRuleError(400,'Invalid rule ID.');
  const rule:AlertRule={id,userId:uid,name:input.name.trim(),description:String(input.description||'').slice(0,500),enabled:input.enabled,category:input.category,priority:input.priority,scope:input.scope,symbols:input.symbols.map((s:string)=>s.trim().toUpperCase()).filter(Boolean),keywords:input.keywords.map((s:string)=>s.trim().toLowerCase()).filter(Boolean),excludeKeywords:input.excludeKeywords.map((s:string)=>s.trim().toLowerCase()).filter(Boolean),channels:{inApp:input.channels.inApp,telegram:input.channels.telegram},createdAt:Date.now()};
  if(durable()) {
    const existing=await cloud<any>(()=>getSupabase().from('alert_rules').select('id,user_id,rule').eq('id',id).abortSignal(AbortSignal.timeout(10000)).maybeSingle());
    if(existing && (existing.user_id!==uid||presetKeyOf(existing.rule)))throw new AlertRuleError(404,'Alert rule not found.');
    if(existing) {
      rule.createdAt=existing.rule.createdAt;
      const changed=await cloud<any[]>(()=>getSupabase().from('alert_rules').update({rule}).eq('id',id).eq('user_id',uid).select('id').abortSignal(AbortSignal.timeout(10000)));
      if(!changed?.length)throw new AlertRuleError(404,'Alert rule not found.');
    } else {
      await cloud(()=>getSupabase().from('alert_rules').insert({id,user_id:uid,rule}).select('id').abortSignal(AbortSignal.timeout(10000)));
    }
    invalidateRulesCache();
  } else {
    const existing=rulesCache.find(r=>r.id===id);
    if(existing&&existing.userId!==uid)throw new AlertRuleError(404,'Alert rule not found.');
    rulesCache=[...rulesCache.filter(r=>r.id!==id),rule];writeLocalJson(ALERT_RULES_FILE,rulesCache);
  }
  return rule;
}
export async function toggleAlertRule(id:string,enabled:boolean,uid='guest'):Promise<boolean> {
  requireOwner(uid); if(id.startsWith('preset_'))return false;
  if(typeof enabled!=='boolean')throw new AlertRuleError(400,'Enabled must be true or false.');
  const rule=(await getAllAlertRules(uid)).find(r=>r.id===id&&!presetKeyOf(r));
  if(!rule)return false;
  await saveAlertRule({...rule,enabled},uid); return true;
}
export async function deleteAlertRule(id:string,uid='guest'):Promise<boolean> {
  requireOwner(uid); if(id.startsWith('preset_'))return false;
  if(durable()) {
    const data=await cloud<any[]>(()=>getSupabase().from('alert_rules').delete().eq('id',id).eq('user_id',uid).select('id').abortSignal(AbortSignal.timeout(10000)));
    invalidateRulesCache();
    return !!data?.length;
  }
  const before=rulesCache.length;rulesCache=rulesCache.filter(r=>!(r.id===id&&r.userId===uid));writeLocalJson(ALERT_RULES_FILE,rulesCache);return before!==rulesCache.length;
}
export interface RuleAnnouncement {companyName?:string;symbol?:string;scripCode?:string;subject?:string;details?:string;category?:string;priority?:string;isWatchlist?:boolean;}
export function evaluateAlertRulesForUser(announcement:RuleAnnouncement,uid='system',snapshot:AlertRule[]=rulesCache) {
  const configured=effectiveAlertRules(snapshot,uid).some(r=>!!presetKeyOf(r));
  const activeRules=view(snapshot,uid).filter(r=>r.enabled);
  const matchedRules:AlertRule[]=[];
  const text=`${announcement.subject||''} ${announcement.details||''} ${announcement.companyName||''}`.toLowerCase();
  const prio=(announcement.priority||'LOW').toUpperCase();
  const patterns:Record<string,RegExp>={RESULTS:/financial result|audited|unaudited|quarterly result|board meeting outcome/i,DIVIDEND:/dividend|bonus|split|sub.division|rights issue/i,BUYBACK:/buy.?back|open offer/i,BONUS_SPLIT:/bonus|split|sub.division/i,ORDER_WIN:/order|contract|agreement|award|pact|bagged/i,BOARD_MEETING:/board meeting|intimation of board/i,GOVERNANCE:/director|management|governance|resignation|appointment|auditor/i};
  for(const rule of activeRules) {
    if(rule.scope==='WATCHLIST_ONLY'&&!announcement.isWatchlist)continue;
    if(rule.scope==='SPECIFIC_SYMBOLS'&&!rule.symbols.some(s=>isSymbolMatch(announcement.companyName||announcement.symbol||'', '',s,announcement.scripCode)||s.toUpperCase()===announcement.symbol?.toUpperCase()))continue;
    const pattern=rule.presetKey==='corporate'?/dividend|bonus|split|sub.division|rights issue|buy.?back|open offer/i:patterns[rule.category];
    if(rule.category!=='ALL' && announcement.category!==rule.category && !pattern?.test(text))continue;
    if(rule.priority==='HIGH_ONLY'&&prio!=='HIGH')continue;
    if(rule.priority==='MEDIUM_HIGH'&&!['HIGH','MEDIUM'].includes(prio))continue;
    if(rule.excludeKeywords.some(k=>k.trim()&&text.includes(k.toLowerCase())))continue;
    if(rule.keywords.length&&!rule.keywords.some(k=>k.trim()&&text.includes(k.toLowerCase())))continue;
    matchedRules.push(rule);
  }
  return {matchedRules,hasConfiguredPresets:configured,shouldSendInApp:matchedRules.some(r=>r.channels.inApp),shouldSendTelegram:matchedRules.some(r=>r.channels.telegram)};
}
export function evaluateAlertRules(announcement:RuleAnnouncement) {return evaluateAlertRulesForUser(announcement,'system');}
