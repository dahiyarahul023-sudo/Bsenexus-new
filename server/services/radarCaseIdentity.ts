import { createHash } from 'node:crypto';
import type { RadarSource } from '../../src/shared/impactRadar.js';

export function radarSourceIdentity(source: RadarSource): string {
  const url = new URL(source.url); url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/i.test(key)) url.searchParams.delete(key);
  return url.href;
}
/** Company names, dates or a generic appeal number are not a proceeding identity.
 * Only an explicit case type + number/year + a single identified forum may join sources.
 * Uncertain sources remain separate; editorial publishing can explicitly append to an existing ID.
 */
export function radarCaseIdentity(companyCode: string, authority: string, title: string, source: RadarSource, publishedAt: string) {
  const references=[...title.matchAll(/\b(civil appeal|criminal appeal|writ petition\s*\((?:civil|criminal)\))\s+(?:number\b|no\.?\s*|#)\s*(\d{1,8})\s*(?:\/|of\s+)((?:19|20)\d{2})\b/gi)];
  const typed=references.length===1?references[0]:null;
  const forum = authority === 'Supreme Court' && /\bSupreme Court of India\b|\bIndian Supreme Court\b/i.test(title) ? 'Supreme Court of India' : null;
  const reference = typed && forum ? `${typed[1].toLowerCase().replace(/\s+/g,' ')}:${+typed[2]}/${typed[3]}` : null;
  const key = reference ? `${companyCode}:${forum}:${reference}` : `${companyCode}:${radarSourceIdentity(source)}:${new Date(publishedAt).toISOString()}:${title.toLowerCase().replace(/\s+/g,' ').trim()}`;
  return { id: `radar_${createHash('sha256').update(`case-v2:${key}`).digest('hex').slice(0,32)}`, kind: reference ? 'referenced' as const : 'provisional' as const, reference, forum };
}
