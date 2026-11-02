import React from 'react';

export type CompanySymbol = 'RELIANCE' | 'INFY' | 'HDFCBANK' | 'TCS';

interface CompanyLogoProps {
  symbol: CompanySymbol;
  size?: number;
  className?: string;
}

const LOGO_SRC: Record<CompanySymbol, string> = {
  RELIANCE: '/company-logos/reliance.svg',
  INFY: '/company-logos/infosys.svg',
  HDFCBANK: '/company-logos/hdfc-bank.svg',
  TCS: '/company-logos/tcs.svg',
};

/**
 * CompanyLogo — Official company brand marks for landing cards.
 * Uses official vector depictions in public/company-logos/
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
        className="w-full h-full object-contain select-none"
      />
    </span>
  );
}
