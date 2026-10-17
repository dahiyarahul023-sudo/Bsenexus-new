import { isNeutralRadarText } from '../../src/shared/impactRadar.js';
export interface RadarIntakeRule {
  id: string; category: string; label: string; terms: string[]; exclude_terms: string[]; priority: number; active: boolean;
}
export const DEFAULT_RADAR_INTAKE_RULES: RadarIntakeRule[] = [
  { id: 'governance_report', category: 'governance', label: 'Governance report', terms: ['accounting irregularities','financial irregularities','fraud','fraud allegations','alleges','whistleblower','short seller report','forensic report','misstatement','bribery','investigation'], exclude_terms: [], priority: 10, active: true },
  { id: 'operational_incident', category: 'operations', label: 'Operational development', terms: ['plant fire','factory fire','explosion','production halted','halts production','production suspended','plant shutdown','factory shutdown','cyberattack','cyber attack','data breach','product recall','licence revoked','license revoked','licence suspended','license suspended'], exclude_terms: [], priority: 20, active: true },
  { id: 'financial_liability', category: 'liability', label: 'Financial liability', terms: ['loan default','debt default','payment default','tax demand','demand notice','credit rating downgrade'], exclude_terms: [], priority: 30, active: true },
  { id: 'business_restriction', category: 'restriction', label: 'Business restriction', terms: ['debarment','business ban','trading suspension','operations suspended','business restriction'], exclude_terms: [], priority: 40, active: true },
  { id: 'corporate_transaction', category: 'deals', label: 'Corporate transaction', terms: ['insolvency','bankruptcy','acquisition','merger','demerger','takeover','arbitration'], exclude_terms: [], priority: 50, active: true },
];
export const radarWords = (value: string) => ` ${value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
export function isRadarIntakeRule(r: any): r is RadarIntakeRule {
  const terms = (a: any, min: number) => Array.isArray(a) && a.length >= min && a.length <= 100 && a.every(t => typeof t === 'string' && t.length >= 3 && t.length <= 100 && /^[a-zA-Z0-9][a-zA-Z0-9 &'-]*$/.test(t));
  return r && /^[a-z][a-z0-9_-]{0,63}$/.test(r.id) && /^[a-z][a-z0-9_-]{0,63}$/.test(r.category) && isNeutralRadarText(r.label, 100) && terms(r.terms, 1) && terms(r.exclude_terms, 0) && Number.isInteger(r.priority) && typeof r.active === 'boolean';
}
/** Literal bounded phrases only. Configuration cannot execute code or introduce expensive regexes. */
export function matchRadarIntakeRule(value: string, rules: readonly RadarIntakeRule[]) {
  const words = radarWords(value);
  return [...rules].filter(isRadarIntakeRule).filter(r => r.active).sort((a,b) => a.priority - b.priority || a.id.localeCompare(b.id))
    .find(r => r.terms.some(t => words.includes(radarWords(t))) && !r.exclude_terms.some(t => words.includes(radarWords(t)))) || null;
}
