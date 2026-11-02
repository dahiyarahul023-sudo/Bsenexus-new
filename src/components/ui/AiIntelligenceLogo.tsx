import React from 'react';

interface AiIntelligenceLogoProps {
  size?: number;
  className?: string;
}

/**
 * AiIntelligenceLogo — bespoke geometric institutional AI emblem.
 * Replaces generic cartoon sparkles with a precision multi-axis diamond prism.
 */
export function AiIntelligenceLogo({ size = 20, className = '' }: AiIntelligenceLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ai-prism-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>
      {/* Outer precision facet */}
      <path
        d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z"
        fill="url(#ai-prism-grad)"
        fillOpacity="0.2"
        stroke="url(#ai-prism-grad)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Inner core diamond */}
      <path
        d="M12 7L13.5 10.5L17 12L13.5 13.5L12 17L10.5 13.5L7 12L10.5 10.5L12 7Z"
        fill="url(#ai-prism-grad)"
      />
      {/* Subtle micro node points */}
      <circle cx="12" cy="12" r="1.5" fill="#FFFFFF" />
    </svg>
  );
}
