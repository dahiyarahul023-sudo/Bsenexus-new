import React from 'react';

export type CompanySymbol =
  | 'RELIANCE'
  | 'INFY'
  | 'HDFCBANK'
  | 'TCS'
  | 'ICICIBANK'
  | 'BHARTIARTL'
  | 'SBIN'
  | 'LT'
  | 'ITC'
  | 'MARUTI'
  | 'TATAMOTORS'
  | 'BAJFINANCE'
  | 'SUNPHARMA'
  | 'TITAN'
  | 'WIPRO'
  | 'BEL'
  | 'NTPC'
  | 'ONGC'
  | 'COALINDIA'
  | 'HINDALCO'
  | 'BSE'
  | 'NSE';

interface CompanyLogoProps {
  symbol: CompanySymbol;
  size?: number;
  className?: string;
}

export const LOGO_SRC: Record<CompanySymbol, string> = {
  RELIANCE: '/company-logos/reliance.svg',
  INFY: '/company-logos/infosys.svg',
  HDFCBANK: '/company-logos/hdfc-bank.svg',
  TCS: '/company-logos/tcs.svg',
  ICICIBANK: '/company-logos/icicibank.png',
  BHARTIARTL: '/company-logos/bhartiartl.png',
  SBIN: '/company-logos/sbin.png',
  LT: '/company-logos/lt.png',
  ITC: '/company-logos/itc.png',
  MARUTI: '/company-logos/maruti.png',
  TATAMOTORS: '/company-logos/tatamotors.png',
  BAJFINANCE: '/company-logos/bajfinance.png',
  SUNPHARMA: '/company-logos/sunpharma.png',
  TITAN: '/company-logos/titan.png',
  WIPRO: '/company-logos/wipro.png',
  BEL: '/company-logos/bel.png',
  NTPC: '/company-logos/ntpc.png',
  ONGC: '/company-logos/ongc.png',
  COALINDIA: '/company-logos/coalindia.png',
  HINDALCO: '/company-logos/hindalco.png',
  BSE: '/company-logos/bse-india.png',
  NSE: '/company-logos/nse-india.png',
};

/**
 * CompanyLogo — Official company & exchange brand marks for landing cards.
 * Uses official vector/raster depictions in public/company-logos/
 * rendered inside a polished, high-contrast, theme-adaptive tile.
 */
export function CompanyLogo({ symbol, size = 36, className = '' }: CompanyLogoProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-xl bg-white border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] p-1.5 overflow-hidden shrink-0 transition-transform duration-200 group-hover:scale-105 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={LOGO_SRC[symbol]}
        alt={`${symbol} brand mark`}
        draggable={false}
        loading="lazy"
        className="w-full h-full object-contain select-none"
      />
    </span>
  );
}

/**
 * Authentic 4-Color Google 'G' Emblem for Material 3 Sign-In & Auth CTAs.
 */
export function GoogleGLogo({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 select-none ${className}`}
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z"
      />
    </svg>
  );
}
