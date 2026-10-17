import { validRadarTime } from '../../src/shared/impactRadar.js';
/** RSS RFC 822 dates are valid evidence too; never interpret an unzoned date in host local time. */
export function newsPublicationTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (validRadarTime(value as unknown)) return new Date(value).toISOString();
  const m = value.trim().match(/^(?:[A-Za-z]{3},\s*)?(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+(GMT|UTC|UT|[+-]\d{4})$/i);
  if (!m) return null;
  const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2].toLowerCase()) + 1;
  const zone = /^[+-]/.test(m[7]) ? `${m[7].slice(0,3)}:${m[7].slice(3)}` : 'Z';
  const iso = `${m[3]}-${String(month).padStart(2,'0')}-${m[1].padStart(2,'0')}T${m[4]}:${m[5]}:${m[6] || '00'}${zone}`;
  return validRadarTime(iso) ? new Date(iso).toISOString() : null;
}
