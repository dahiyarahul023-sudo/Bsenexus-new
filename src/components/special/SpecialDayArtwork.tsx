import React from 'react';

/**
 * Original festive SVG artwork for the Special Day story (Budget Day 2027).
 * Drawn for BSE Nexus — never copied from Groww or any other app.
 *
 * Gradient defs live in <SpecialDayArtDefs /> (rendered once by the story
 * modal); the art components reference them by id. The lotus petals are
 * REAL elements (not <use> clones) so their draw-in animation restarts
 * every time the timing card mounts.
 */

export function SpecialDayArtDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="sds-lotus-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f97316" />
          <stop offset=".5" stopColor="#a855f7" />
          <stop offset="1" stopColor="#fbbf24" />
        </linearGradient>
        <linearGradient id="sds-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="sds-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset=".55" stopColor="#f97316" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const petalDelay = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties;

/** Lotus line-art. Petals draw themselves in one by one (see .sds-lotus path). */
export function LotusArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 320 200" aria-hidden="true">
      <g fill="none" stroke="url(#sds-lotus-stroke)" strokeWidth="1.4" opacity=".85">
        <path pathLength={100} style={petalDelay(200)} d="M160 25 C 174 65, 174 105, 160 140 C 146 105, 146 65, 160 25 Z" />
        <path pathLength={100} style={petalDelay(300)} d="M160 40 C 192 65, 202 100, 188 140 C 172 112, 164 78, 160 40 Z" />
        <path pathLength={100} style={petalDelay(300)} d="M160 40 C 128 65, 118 100, 132 140 C 148 112, 156 78, 160 40 Z" />
        <path pathLength={100} style={petalDelay(420)} d="M160 55 C 206 75, 226 108, 216 142 C 192 120, 174 92, 160 55 Z" />
        <path pathLength={100} style={petalDelay(420)} d="M160 55 C 114 75, 94 108, 104 142 C 128 120, 146 92, 160 55 Z" />
        <path pathLength={100} style={petalDelay(540)} d="M160 80 C 218 90, 256 118, 258 148 C 220 138, 188 115, 160 80 Z" />
        <path pathLength={100} style={petalDelay(540)} d="M160 80 C 102 90, 64 118, 62 148 C 100 138, 132 115, 160 80 Z" />
        <path pathLength={100} style={petalDelay(640)} d="M62 152 Q160 178 258 152" opacity=".6" />
      </g>
      <circle cx="160" cy="148" r="8" fill="none" stroke="url(#sds-lotus-stroke)" strokeWidth="1.2" opacity=".7" />
    </svg>
  );
}

/** Diya (oil lamp) with a flickering flame. */
export function DiyaArt({ className, width, height }: { className?: string; width?: number; height?: number }) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 60 56" aria-hidden="true">
      <ellipse cx="30" cy="52" rx="26" ry="4" fill="#f97316" opacity=".25" />
      <path className="sds-flame" d="M30 12 C 36 22, 38 28, 30 36 C 22 28, 24 22, 30 12 Z" fill="url(#sds-flame)" />
      <path d="M6 38 Q30 30 54 38 L50 48 Q30 56 10 48 Z" fill="url(#sds-gold)" />
      <path d="M6 38 Q30 46 54 38" fill="none" stroke="#b45309" strokeWidth="1" />
    </svg>
  );
}

/** Hanging festive lantern. */
export function LanternArt({ className, width, height, style }: { className?: string; width?: number; height?: number; style?: React.CSSProperties }) {
  return (
    <svg className={className} width={width} height={height} style={style} viewBox="0 0 80 86" aria-hidden="true">
      <line x1="40" y1="0" x2="40" y2="14" stroke="#a855f7" strokeWidth="1.5" />
      <path d="M22 14 h36 l-4 10 h-28 Z" fill="#f97316" />
      <rect x="20" y="24" width="40" height="34" rx="6" fill="#fbbf24" />
      <path d="M20 32 L60 32 M20 42 L60 42 M20 50 L60 50" stroke="#ea580c" strokeWidth="1.4" />
      <path d="M28 58 h24 l-3 8 h-18 Z" fill="#a855f7" />
      <line x1="34" y1="66" x2="34" y2="80" stroke="#fbbf24" strokeWidth="1.5" />
      <line x1="40" y1="66" x2="40" y2="84" stroke="#f97316" strokeWidth="1.5" />
      <line x1="46" y1="66" x2="46" y2="80" stroke="#a855f7" strokeWidth="1.5" />
    </svg>
  );
}

const LIGHT_DOTS: Array<{ x: number; color: string }> = [
  { x: 30, color: '#f97316' },
  { x: 70, color: '#a855f7' },
  { x: 110, color: '#fbbf24' },
  { x: 150, color: '#f472b6' },
  { x: 190, color: '#f97316' },
  { x: 230, color: '#a855f7' },
  { x: 270, color: '#fbbf24' },
  { x: 310, color: '#f472b6' },
  { x: 340, color: '#f97316' }
];

/** String of festive lights across the top of the cover card. */
export function StringLights({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 360 34" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 4 Q 180 30 360 4" fill="none" stroke="#ffffff22" strokeWidth="1" />
      {LIGHT_DOTS.map(({ x, color }) => (
        <circle key={x} cx={x} cy={8 + Math.sin(x / 40) * 4} r="3.2" fill={color} />
      ))}
    </svg>
  );
}
