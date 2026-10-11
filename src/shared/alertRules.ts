export type PresetKey = 'results' | 'corporate' | 'material';
export interface AlertRule {
  id: string; name: string; description?: string; enabled: boolean;
  category: 'ALL' | 'RESULTS' | 'DIVIDEND' | 'BUYBACK' | 'BONUS_SPLIT' | 'ORDER_WIN' | 'BOARD_MEETING' | 'GOVERNANCE';
  priority: 'ALL' | 'HIGH_ONLY' | 'MEDIUM_HIGH';
  scope: 'ALL_STOCKS' | 'WATCHLIST_ONLY' | 'SPECIFIC_SYMBOLS';
  symbols: string[]; keywords: string[]; excludeKeywords: string[];
  channels: { inApp: boolean; telegram: boolean };
  userId: string; createdAt: number; presetKey?: PresetKey;
}
export interface AlertPresets {
  results: boolean; corporate: boolean; material: boolean;
  scope: 'WATCHLIST_ONLY' | 'ALL_STOCKS';
  channels: { inApp: boolean; telegram: boolean };
}
export const DEFAULT_ALERT_PRESETS: AlertPresets = {
  results: true, corporate: true, material: true,
  scope: 'WATCHLIST_ONLY', channels: { inApp: true, telegram: true }
};
export const PRESET_NAMES: Record<PresetKey,string> = {
  results: 'Financial Results Preset', corporate: 'Corporate Actions Preset', material: 'All Material Updates Preset'
};
export function presetKeyOf(rule: AlertRule): PresetKey | undefined {
  if (rule.presetKey && Object.hasOwn(PRESET_NAMES, rule.presetKey)) return rule.presetKey;
  // Only exact legacy generated names qualify; a custom RESULTS rule is not a preset.
  return (Object.keys(PRESET_NAMES) as PresetKey[]).find(k => PRESET_NAMES[k] === rule.name);
}
export function effectiveAlertRules(rows: AlertRule[], uid: string): AlertRule[] {
  const own = rows.filter(r => r.userId === uid);
  const latest = new Map<PresetKey,AlertRule>();
  for (const r of own) {
    const key = presetKeyOf(r); if (!key) continue;
    const prev = latest.get(key);
    // Canonical saves take precedence over archived duplicates from old app versions.
    if (!prev || (r.presetKey && !prev.presetKey) || (!!r.presetKey === !!prev.presetKey && (r.createdAt > prev.createdAt || (r.createdAt === prev.createdAt && r.id > prev.id)))) latest.set(key, r);
  }
  return [...own.filter(r=>!presetKeyOf(r)), ...[...latest.entries()].map(([presetKey,r])=>({...r,presetKey}))];
}
export function presetsFromRules(rules: AlertRule[]): AlertPresets {
  const presets = rules.filter(r=>presetKeyOf(r));
  const latest = [...presets].sort((a,b)=>b.createdAt-a.createdAt)[0];
  const enabled = (k: PresetKey) => presets.find(r=>presetKeyOf(r)===k)?.enabled ?? DEFAULT_ALERT_PRESETS[k];
  return {results:enabled('results'),corporate:enabled('corporate'),material:enabled('material'),
    scope: latest?.scope === 'ALL_STOCKS' ? 'ALL_STOCKS' : 'WATCHLIST_ONLY',
    channels: latest?.channels || {...DEFAULT_ALERT_PRESETS.channels}};
}
export function makePresetRules(uid: string, values: AlertPresets, idFor: (k: PresetKey)=>string, now=Date.now()): AlertRule[] {
  return (Object.keys(PRESET_NAMES) as PresetKey[]).map(key=>({
    id:idFor(key),userId:uid,presetKey:key,name:PRESET_NAMES[key],createdAt:now,
    description: key==='results'?'Quarterly and annual financial results':key==='corporate'?'Dividends, bonus, splits, rights issues and buybacks':'High-impact material filings',
    enabled:values[key],category:key==='results'?'RESULTS':key==='corporate'?'DIVIDEND':'ALL',
    priority:key==='material'?'HIGH_ONLY':'ALL',scope:values.scope,symbols:[],keywords:[],
    excludeKeywords:key==='material'?['loss of share','duplicate certificate','scrutinizer']:[],channels:{...values.channels}
  }));
}
