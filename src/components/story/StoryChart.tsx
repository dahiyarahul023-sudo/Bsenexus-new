import React, { useId, useState } from 'react';
import type { StoryChartData } from './storyTypes';
import { storyNumber } from './storyBuilder';

export function storyChartScale(chart: StoryChartData) {
  const values = chart.points.flatMap(point => point.values).filter(Number.isFinite);
  let max = Math.max(0, ...values); let min = Math.min(0, ...values);
  if (max === 0 && min === 0) { max = 1; min = -1; }
  const range = max - min || 1;
  const top = 44; const height = 196;
  return { y: (value: number) => top + (max - value) / range * height, zero: top + max / range * height, top, height };
}

/** One honest shared scale, direct labels, and optional pointer/keyboard inspection. */
export const StoryChart = React.memo(function StoryChart({ chart, onInspectChange }: { chart: StoryChartData; onInspectChange?: (active: boolean) => void }) {
  const id = useId().replace(/:/g, '');
  const [active, setActive] = useState<string | null>(null);
  const scale = storyChartScale(chart);
  const groupWidth = 296 / Math.max(chart.points.length, 1);
  const barWidth = Math.min(42, groupWidth / (chart.series.length + 1.8));
  const selected = chart.points.flatMap((point, p) => point.values.map((value, s) => ({ key: `${p}-${s}`, point, value, series: chart.series[s] }))).find(item => item.key === active);
  const inspect = (key: string | null) => { setActive(key); onInspectChange?.(key !== null); };
  return <figure className="story-chart" data-story-interactive="true">
    <div className="story-chart-unit">{chart.unit}</div>
    <svg viewBox="0 0 320 286" role="group" aria-label={chart.title}>
      <defs>
        {(['accent', 'blue', 'rose'] as const).map(colour => <React.Fragment key={colour}>
          <linearGradient id={`${id}-${colour}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={`var(--story-${colour})`} /><stop offset="1" stopColor={`var(--story-${colour})`} stopOpacity=".09" /></linearGradient>
          <linearGradient id={`${id}-${colour}-negative`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={`var(--story-${colour})`} stopOpacity=".09" /><stop offset="1" stopColor={`var(--story-${colour})`} /></linearGradient>
        </React.Fragment>)}
      </defs>
      <line x1="12" x2="308" y1={scale.zero} y2={scale.zero} stroke="currentColor" opacity=".2" />
      {chart.points.map((point, p) => <g key={point.label}>
        {point.values.map((value, s) => {
          if (!Number.isFinite(value) || !chart.series[s]) return null;
          const key = `${p}-${s}`; const negative = value < 0;
          const x = 12 + groupWidth * (p + .5) + (s - (chart.series.length - 1) / 2) * (barWidth + 8) - barWidth / 2;
          const y = Math.min(scale.zero, scale.y(value)); const height = Math.abs(scale.y(value) - scale.zero);
          const colour = chart.signed ? negative ? 'rose' : 'accent' : chart.series[s].colour || 'blue';
          const label = `${point.label}, ${chart.series[s].label}: ${value < 0 ? 'minus ' : ''}${storyNumber(Math.abs(value), 2)} ${chart.unit}`;
          return <g key={key} tabIndex={0} role="button" aria-label={label} aria-pressed={active === key}
            onFocus={() => inspect(key)} onBlur={() => inspect(null)} onClick={event => { event.stopPropagation(); inspect(key); }}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); inspect(active === key ? null : key); } }}>
            <rect className="story-chart-hit" x={x - 4} y="12" width={barWidth + 8} height="250" fill="transparent" />
            {value === 0 ? <line x1={x} x2={x + barWidth} y1={scale.zero} y2={scale.zero} stroke={`var(--story-${colour})`} strokeWidth="2" /> :
              <rect className="story-chart-bar" x={x} y={y} width={barWidth} height={height} rx={Math.min(4, height / 2)} fill={`url(#${id}-${colour}${negative ? '-negative' : ''})`} />}
            <text x={x + barWidth / 2} y={negative ? scale.y(value) + 17 : scale.y(value) - 10} textAnchor="middle" className="story-chart-value">{value < 0 ? '−' : ''}{storyNumber(Math.abs(value))}</text>
          </g>;
        })}
        <text x={12 + groupWidth * (p + .5)} y="281" textAnchor="middle" className="story-chart-label">{point.label}</text>
      </g>)}
    </svg>
    <figcaption className="story-chart-legend">{chart.series.length > 1 ? chart.series.map(series => <span key={series.label}><i style={{ background: `var(--story-${series.colour || 'blue'})` }} />{series.label}</span>) : <span>{chart.signed ? 'Net buying (+) / selling (−)' : chart.series[0]?.label}</span>}</figcaption>
    <div className="story-chart-inspection" aria-live="polite">{selected ? `${selected.point.label} · ${selected.series?.label}: ${selected.value < 0 ? '−' : ''}${storyNumber(Math.abs(selected.value), 2)} ${chart.unit}` : 'Tap a bar for the exact value'}</div>
  </figure>;
});
