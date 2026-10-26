import { resultTimingHistory, clockLabel } from '../utils/resultTiming';
import { heliosCard } from './ui/helios';
export function ResultTimingPanel({ results }: {results:any[]}) {
  const {points,window,exceptions}=resultTimingHistory(results);
  return <section className={`${heliosCard} result-timing p-3 sm:p-4 space-y-2`} aria-label="Historical result filing times">
    <h3 className="text-sm font-bold text-slate-900 dark:text-white">When results were filed · IST</h3>
    {!points.length ? <p className="text-xs text-slate-600 dark:text-slate-300">Verified filing times are not available in saved results yet.</p> : <>
    <p className="text-xs text-slate-600 dark:text-slate-300">{window ? `${window.count} of ${points.length} recent quarters were filed between ${clockLabel(window.start)} and ${clockLabel(window.start+window.duration)} IST.${window.start+window.duration>=1440?' Window crosses midnight.':''}` : points.length<4 ? `${points.length} timed quarters available. At least 4 are needed to identify a usual window.` : 'No consistent 1–2 hour window in the available quarters.'}</p>
    <svg viewBox={`0 0 600 ${points.length*34+28}`} role="img" aria-label="Historical filing times by quarter; orange dots mark exceptions">
      {[0,6,12,18,24].map(hour=><g key={hour}><line x1={110+hour/24*400} x2={110+hour/24*400} y1="18" y2={points.length*34+20} stroke="currentColor" opacity=".1"/><text x={110+hour/24*400} y="12" textAnchor="middle" fontSize="16" fill="currentColor">{hour}:00</text></g>)}
      {window && (window.start+window.duration<=1440 ? <rect x={110+window.start/1440*400} y="18" width={window.duration/1440*400} height={points.length*34+5} fill="#059669" opacity=".10"/> : <><rect x={110+window.start/1440*400} y="18" width={(1440-window.start)/1440*400} height={points.length*34+5} fill="#059669" opacity=".10"/><rect x="110" y="18" width={(window.start+window.duration-1440)/1440*400} height={points.length*34+5} fill="#059669" opacity=".10"/></>)}
      {points.map((point,i)=>{const out=exceptions.includes(point);return <g key={point.quarter}><text x="0" y={i*34+40} fontSize="18" fill="currentColor">{point.quarter}</text><line x1="110" x2="510" y1={i*34+36} y2={i*34+36} stroke="currentColor" opacity=".1"/><circle cx={110+point.minute/1440*400} cy={i*34+36} r="5" fill={out?'#d97706':'#059669'}/><text x="530" y={i*34+40} fontSize="18" fill="currentColor">{clockLabel(point.minute)}</text></g>;})}
    </svg>
    <details className="text-xs text-slate-600 dark:text-slate-300"><summary className="cursor-pointer min-h-9">View dates and filing times</summary><ul className="space-y-1">{points.map(point=><li key={point.quarter}>{point.quarter} · {point.date} · {clockLabel(point.minute)} IST{exceptions.includes(point)?' · Exception':''}</li>)}</ul></details>
    {exceptions.length>0 && <p className="text-xs text-amber-700 dark:text-amber-300">Exceptions: {exceptions.map(p=>`${p.quarter} · ${p.date} · ${clockLabel(p.minute)} IST`).join('; ')}</p>}
    <p className="text-[11px] text-slate-500 dark:text-slate-400">First verified result filing per quarter, latest {points.length} available. Historical pattern, not a promised release time. Meeting dates and fetch times are excluded.</p>
    </>}
  </section>;
}
