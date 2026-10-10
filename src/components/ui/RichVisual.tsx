import { useId, type ReactNode } from 'react';
import '../../styles/rich-ui.css';

export type RichTone = 'emerald' | 'violet' | 'amber' | 'sky' | 'slate' | 'rose';

/** Decorative depth only. The containing control supplies its name and state. */
export function RichIcon({ children, tone = 'emerald', className = '' }: {
  children: ReactNode; tone?: RichTone; className?: string;
}) {
  return <span aria-hidden="true" className={`rich-icon rich-tone-${tone} ${className}`}>
    <span className="rich-icon-glyph">{children}</span>
  </span>;
}

/** Real date content stays opaque; depth is confined to the tile's surfaces. */
export function RichDateTile({ day, month, selected = false, today = false }: {
  day: string; month: string; selected?: boolean; today?: boolean;
}) {
  return <span className={`rich-date-tile ${selected ? 'is-selected' : ''} ${today ? 'is-today' : ''}`}>
    <span className="rich-date-month">{month}</span>
    <span className="rich-date-day">{day}</span>
  </span>;
}

type IllustrationKind = 'companies' | 'pro' | 'creator' | 'bell' | 'success';
const palettes: Record<IllustrationKind, [string, string, string]> = {
  companies: ['#a7f3d0', '#14b8a6', '#047857'],
  pro: ['#fef3c7', '#fbbf24', '#b45309'],
  creator: ['#ddd6fe', '#a78bfa', '#6d28d9'],
  bell: ['#bae6fd', '#38bdf8', '#2563eb'],
  success: ['#a7f3d0', '#2dd4bf', '#059669'],
};

/** Small native vectors: no image download, backdrop blur, canvas or render loop. */
export function RichIllustration({ kind, className = '' }: { kind: IllustrationKind; className?: string }) {
  const id = `rich-${useId().replace(/:/g, '')}`;
  const [light, mid, deep] = palettes[kind];
  const fill = `url(#${id}-body)`;
  const glass = `url(#${id}-glass)`;
  return <svg viewBox="0 0 200 164" className={`rich-illustration rich-illustration-${kind} ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={light} /><stop offset=".42" stopColor={mid} /><stop offset="1" stopColor={deep} /></linearGradient>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2=".7" y2="1"><stop stopColor="white" stopOpacity=".55" /><stop offset=".6" stopColor="white" stopOpacity=".14" /><stop offset="1" stopColor={deep} stopOpacity=".22" /></linearGradient>
      <radialGradient id={`${id}-floor`}><stop stopColor={deep} stopOpacity=".2" /><stop offset="1" stopColor={deep} stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse cx="100" cy="146" rx="85" ry="15" fill={`url(#${id}-floor)`} />
    {kind === 'companies' && <>
      <rect x="32" y="64" width="43" height="71" rx="9" fill={fill} opacity=".65" />
      <path d="M70 40 112 26 138 40v95H70Z" fill={fill} />
      <path d="m112 26 26 14v95h-26Z" fill={deep} opacity=".5" />
      <path d="M79 53h21M79 69h21M79 85h21M43 79h18M43 96h18" stroke={deep} strokeOpacity=".5" strokeWidth="6" />
      <rect x="83" y="89" width="69" height="51" rx="13" fill={mid} />
      <rect x="83" y="89" width="69" height="51" rx="13" fill={glass} stroke="white" strokeOpacity=".55" />
      <path d="m117 98 5 10 12 2-9 8 2 12-10-6-11 6 2-12-8-8 12-2Z" fill="#ecfdf5" />
    </>}
    {kind === 'pro' && <>
      <rect x="31" y="118" width="138" height="24" rx="9" fill={deep} opacity=".12" />
      <path d="M73 73V53a27 27 0 0 1 54 0v20" fill="none" stroke={deep} strokeWidth="14" />
      <path d="M73 73V53a27 27 0 0 1 54 0v20" fill="none" stroke={fill} strokeWidth="9" />
      <rect x="55" y="68" width="90" height="72" rx="17" fill={fill} />
      <rect x="55" y="68" width="90" height="72" rx="17" fill={glass} stroke="#fff7d6" strokeOpacity=".7" />
      <path d="m77 92 13 9 10-15 10 15 13-9-4 26H81Z" fill="#fff5cf" stroke={deep} strokeOpacity=".2" strokeWidth="2" />
      <path d="M82 125h36" stroke={deep} strokeWidth="4" strokeLinecap="round" opacity=".45" />
      <path d="m160 45 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill={mid} />
    </>}
    {kind === 'creator' && <>
      <rect x="61" y="28" width="94" height="103" rx="19" transform="rotate(9 108 80)" fill={fill} opacity=".6" />
      <rect x="35" y="48" width="112" height="85" rx="19" fill={fill} />
      <rect x="35" y="48" width="112" height="85" rx="19" fill={glass} stroke="white" strokeOpacity=".55" />
      <circle cx="72" cy="77" r="12" fill="#ede9fe" />
      <path d="M52 111v-4a20 20 0 0 1 40 0v4Z" fill="#ede9fe" />
      <path d="m103 84 10 6 8-13 8 13 10-6-3 22h-30Z" fill="#99f6e4" stroke="#0d9488" strokeWidth="2" />
      <path d="m150 79 30-12-12 30-5-13Z" fill="#2dd4bf" stroke="#ccfbf1" strokeWidth="2" />
    </>}
    {kind === 'bell' && <>
      <circle cx="100" cy="128" r="11" fill={fill} />
      <path d="M93 37a7 7 0 0 1 14 0v9H93Z" fill={fill} />
      <path d="M66 78a34 34 0 0 1 68 0v26l11 15H55l11-15Z" fill={fill} stroke="#e0f2fe" strokeOpacity=".5" strokeWidth="2" />
      <path d="M66 78a34 34 0 0 1 68 0v26l11 15H55l11-15Z" fill={glass} />
      <path d="M79 78c0-12 6-19 17-22" fill="none" stroke="white" strokeOpacity=".65" strokeWidth="5" strokeLinecap="round" />
      <circle cx="139" cy="58" r="17" fill="#0d9488" stroke="#99f6e4" strokeWidth="2" />
      <path d="M139 51v8m0 6v1" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </>}
    {kind === 'success' && <>
      <circle cx="100" cy="80" r="59" fill={mid} opacity=".12" />
      <circle cx="100" cy="80" r="47" fill={fill} />
      <circle cx="100" cy="80" r="47" fill={glass} stroke="#d1fae5" strokeOpacity=".7" strokeWidth="2" />
      <path d="m78 80 15 15 30-32" stroke="#f0fdfa" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m164 66 3 7 7 3-7 3-3 7-3-7-7-3 7-3ZM34 88l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill={mid} />
    </>}
  </svg>;
}
