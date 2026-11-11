import React, { useEffect, useRef, useState } from 'react';
import { DiyaArt, LanternArt, LotusArt, StringLights } from './SpecialDayArtwork';
import type { SpecialDayCard, SpecialDayConfig } from '../../config/specialDay';

interface SpecialDayCardTemplateProps {
  card: SpecialDayCard;
  config: SpecialDayConfig;
  /** Slide direction from the modal (1 = next, -1 = previous, 0 = initial). */
  direction?: 1 | -1 | 0;
  paused?: boolean;
  holding?: boolean;
  onActionClick?: (tabId?: string) => void;
  disclaimer: string;
}

const rise = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties;

/** Split "Key Policy Focus Sectors" into "Key Policy" + gold "Focus Sectors". */
function AccentHeadline({ title, accent }: { title: string; accent?: string }) {
  if (!accent || !title.includes(accent)) return <>{title}</>;
  const before = title.slice(0, title.indexOf(accent)).trim();
  return (
    <>
      {before}
      <br />
      <span className="sds-gold-text">{accent}</span>
    </>
  );
}

/** Split "Infrastructure & Capital Goods" after the "&", like the approved preview. */
function AmpersandTitle({ title }: { title: string }) {
  const parts = title.split(' & ');
  if (parts.length !== 2) return <>{title}</>;
  return (
    <>
      {parts[0]} &<br />
      {parts[1]}
    </>
  );
}

const SQUIGGLE_PATH =
  'M4 72 L34 58 L64 66 L94 40 L124 50 L154 28 L184 44 L214 20 L244 34 L274 14 L316 22';

function Squiggle() {
  return (
    <svg className="sds-squiggle" viewBox="0 0 320 90" aria-hidden="true">
      <path d={SQUIGGLE_PATH} />
      <circle r="4.5" fill="#fff">
        <animateMotion dur="1.6s" begin="0.35s" fill="freeze" path={SQUIGGLE_PATH} />
      </circle>
    </svg>
  );
}

/**
 * Count-up for the history stat ("±2.4%"): 0 → target over ~1.1s, then a
 * scale pop. The pop class goes on the INNER span only — stacking a second
 * `animation` on the .sds-rise wrapper would override its rise animation
 * and hide the stat (opacity 0).
 */
function HistoryStat({ value }: { value: string }) {
  const match = value.match(/([+-]?[\d.]+)/);
  const target = match ? parseFloat(match[1]) : NaN;
  const prefix = match ? value.slice(0, match.index) : '';
  const suffix = match ? value.slice((match.index ?? 0) + match[0].length) : '';
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const [text, setText] = useState(`${prefix}0.0${suffix}`);

  useEffect(() => {
    if (Number.isNaN(target)) {
      setText(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 1100;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setText(`${prefix}${(target * eased).toFixed(1)}${suffix}`);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        const el = spanRef.current;
        if (el) {
          el.classList.remove('sds-pop');
          void el.offsetWidth;
          el.classList.add('sds-pop');
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, prefix, suffix, value]);

  return (
    <span ref={spanRef} className="sds-stat-value">
      {text}
    </span>
  );
}

export function SpecialDayCardTemplate({
  card,
  config,
  direction = 0,
  paused = false,
  holding = false,
  onActionClick,
  disclaimer
}: SpecialDayCardTemplateProps) {
  const slideClass =
    direction === 1 ? ' sds-slide-next' : direction === -1 ? ' sds-slide-prev' : '';

  return (
    <div className={`sds-card${slideClass}`}>
      {card.kind === 'cover' && (
        <>
          <div className="sds-fadein" style={{ ...rise(80), width: '100%' }}>
            <StringLights className="w-full" />
          </div>
          <div className="sds-rise" style={{ ...rise(140), display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 10px', marginTop: 6 }}>
            <LanternArt className="sds-sway" width={52} height={86} />
            <LanternArt className="sds-sway sds-sway-slow" width={40} height={66} style={{ marginTop: 26 }} />
          </div>
          <div className="sds-rise" style={{ ...rise(240), marginTop: 26 }}>
            <div className="sds-kicker">✦ &nbsp;{config.badgeText}&nbsp; ✦</div>
            <div className="sds-wordmark" style={{ marginTop: 14 }}>
              {card.title.split(' ').map((word, i) => (
                <React.Fragment key={word}>
                  {i > 0 && <br />}
                  {word}
                </React.Fragment>
              ))}
            </div>
            {card.subtitle && <div className="sds-wordmark-sub">{card.subtitle}</div>}
          </div>
          <div className="sds-bottom-illus sds-rise" style={rise(420)}>
            <DiyaArt width={60} height={56} />
            <DiyaArt width={46} height={44} />
            <DiyaArt width={60} height={56} />
          </div>
        </>
      )}

      {card.kind === 'timing' && (
        <>
          <div className="sds-hero-art sds-kb">
            <LotusArt className="sds-lotus" />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="sds-rise" style={rise(220)}>
                <div className="sds-wordmark" style={{ fontSize: 44 }}>{card.title}</div>
              </div>
              {card.badge && <div className="sds-wordmark-sub sds-rise" style={rise(320)}>{card.badge}</div>}
              {card.subtitle && (
                <div className="sds-rise" style={{ ...rise(420), marginTop: 22, fontSize: 21, fontWeight: 800, color: '#fbbf24', letterSpacing: '-.01em' }}>
                  {card.subtitle}
                </div>
              )}
              {card.headlineStat && (
                <div className="sds-rise" style={{ ...rise(500), marginTop: 4, fontSize: 21, fontWeight: 800, color: '#fbbf24', letterSpacing: '-.01em' }}>
                  {card.headlineStat.value}
                </div>
              )}
            </div>
          </div>
          <div className="sds-bottom-illus sds-rise" style={rise(580)}>
            <DiyaArt width={52} height={49} />
            <DiyaArt width={64} height={60} />
          </div>
        </>
      )}

      {card.kind === 'timeline' && (
        <>
          <h2 className="sds-headline sds-rise" style={rise(120)}>{card.title}</h2>
          {card.subtitle && <p className="sds-sub sds-rise" style={rise(200)}>{card.subtitle}</p>}
          <div className="sds-mini-rows">
            {card.points.map((point, idx) => (
              <div className="sds-mini-row sds-rise" style={rise(300 + idx * 90)} key={idx}>
                {point.tag && <span className="sds-t">{point.tag}</span>}
                <div>
                  <div className="sds-b">{point.title}</div>
                  <div className="sds-s">{point.text}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="sds-bottom-illus sds-rise" style={{ ...rise(560), justifyContent: 'center' }}>
            <DiyaArt width={52} height={49} />
          </div>
        </>
      )}

      {card.kind === 'history' && (
        <>
          <h2 className="sds-headline sds-rise" style={rise(120)}>{card.title}</h2>
          <div className="sds-rise" style={{ ...rise(240), marginTop: 18 }}>
            <Squiggle />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 2 }}>
              <DiyaArt width={26} height={25} />
              <DiyaArt width={26} height={25} />
              <DiyaArt width={26} height={25} />
            </div>
          </div>
          {card.headlineStat && (
            <div className="sds-big-stat sds-rise" style={rise(340)}>
              <HistoryStat value={card.headlineStat.value} />
            </div>
          )}
          {card.headlineStat && (
            <div className="sds-stat-label sds-rise" style={rise(420)}>{card.headlineStat.label}</div>
          )}
          {card.footerNote && (
            <div className="sds-bottom-illus sds-rise" style={{ ...rise(520), justifyContent: 'center' }}>
              <span style={{ fontSize: 11, color: '#aab0c3' }}>{card.footerNote}</span>
            </div>
          )}
        </>
      )}

      {card.kind === 'sectors' && (
        <>
          <h2 className="sds-headline sds-rise" style={rise(120)}>
            <AccentHeadline title={card.title} accent={card.titleAccent} />
          </h2>
          {card.subtitle && <p className="sds-sub sds-rise" style={rise(200)}>{card.subtitle}</p>}
          <div className="sds-sector-rows">
            {card.points.map((point, idx) => (
              <div className="sds-sector-row sds-rise" style={rise(300 + idx * 90)} key={idx}>
                <span className="sds-name"><AmpersandTitle title={point.title} /></span>
                {point.tag && <span className="sds-tag">{point.tag}</span>}
              </div>
            ))}
          </div>
          <div className="sds-bottom-illus sds-rise" style={{ ...rise(560), justifyContent: 'center' }}>
            <DiyaArt width={52} height={49} />
          </div>
        </>
      )}

      {card.kind === 'safety' && (
        <>
          <h2 className="sds-headline sds-rise" style={rise(120)}>
            <AccentHeadline title={card.title} accent={card.titleAccent} />
          </h2>
          {card.subtitle && <p className="sds-sub sds-rise" style={rise(200)}>{card.subtitle}</p>}
          <div className="sds-mini-rows">
            {card.points.map((point, idx) => (
              <div className="sds-mini-row sds-rise" style={rise(300 + idx * 90)} key={idx}>
                {point.tag && <span className="sds-t">{point.tag}</span>}
                <div>
                  <div className="sds-b">{point.title}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="sds-bottom-illus sds-rise" style={{ ...rise(560), justifyContent: 'center' }}>
            <DiyaArt width={52} height={49} />
          </div>
        </>
      )}

      {/* Bottom area: disclaimer + the card's single bottom link (no buttons). */}
      <div style={{ position: 'relative', zIndex: 3, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '10px 0 16px', marginTop: 'auto' }}>
        <div className="sds-disclaimer">{disclaimer}</div>
        {card.actionLabel && (
          <button
            type="button"
            data-story-interactive="true"
            onClick={(e) => {
              e.stopPropagation();
              onActionClick?.(card.actionTab);
            }}
            className="sds-bottom-link"
          >
            <span>{card.actionLabel}</span>
            <span>›</span>
          </button>
        )}
        <div className="sds-pause-note">
          {paused ? 'Paused · tap again to resume' : holding ? 'Holding — paused' : ''}
        </div>
      </div>
    </div>
  );
}
