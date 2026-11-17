import React, { useEffect, useRef } from 'react';

interface ParticleRibbonsProps {
  theme: 'dark' | 'light';
}

interface RibbonConfig {
  colorDark: string;
  colorLight: string;
  glowDark: string;
  glowLight: string;
  speed: number;
  yAnchor: number;
  amplitude: number;
  frequency: number;
  thickness: number;
  phaseOffset: number;
}

interface MarketNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  hueIndex: number;
  phase: number;
}

interface TouchRipple {
  x: number;
  y: number;
  bornAt: number;
  maxRadius: number;
  intensity: number;
}

interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

const RIBBONS: RibbonConfig[] = [
  {
    colorDark: 'rgba(16, 185, 129, 0.34)',
    colorLight: 'rgba(5, 150, 105, 0.22)',
    glowDark: 'rgba(16, 185, 129, 0.58)',
    glowLight: 'rgba(5, 150, 105, 0.38)',
    speed: 0.00055,
    yAnchor: 0.24,
    amplitude: 95,
    frequency: 0.0019,
    thickness: 2.2,
    phaseOffset: 0,
  },
  {
    colorDark: 'rgba(56, 189, 248, 0.30)',
    colorLight: 'rgba(2, 132, 199, 0.20)',
    glowDark: 'rgba(56, 189, 248, 0.52)',
    glowLight: 'rgba(2, 132, 199, 0.34)',
    speed: 0.00072,
    yAnchor: 0.42,
    amplitude: 120,
    frequency: 0.0015,
    thickness: 2.0,
    phaseOffset: 1.8,
  },
  {
    colorDark: 'rgba(99, 102, 241, 0.26)',
    colorLight: 'rgba(79, 70, 229, 0.17)',
    glowDark: 'rgba(129, 140, 248, 0.48)',
    glowLight: 'rgba(79, 70, 229, 0.30)',
    speed: 0.00046,
    yAnchor: 0.58,
    amplitude: 110,
    frequency: 0.0022,
    thickness: 1.8,
    phaseOffset: 3.6,
  },
  {
    colorDark: 'rgba(45, 212, 191, 0.25)',
    colorLight: 'rgba(13, 148, 136, 0.18)',
    glowDark: 'rgba(45, 212, 191, 0.46)',
    glowLight: 'rgba(13, 148, 136, 0.32)',
    speed: 0.00084,
    yAnchor: 0.74,
    amplitude: 85,
    frequency: 0.0025,
    thickness: 1.6,
    phaseOffset: 5.1,
  },
  {
    colorDark: 'rgba(14, 165, 233, 0.22)',
    colorLight: 'rgba(3, 105, 161, 0.15)',
    glowDark: 'rgba(56, 189, 248, 0.42)',
    glowLight: 'rgba(3, 105, 161, 0.28)',
    speed: 0.00062,
    yAnchor: 0.33,
    amplitude: 75,
    frequency: 0.0028,
    thickness: 1.4,
    phaseOffset: 2.7,
  },
];

const NODE_COLORS_DARK = ['#10b981', '#38bdf8', '#2dd4bf', '#818cf8'];
const NODE_COLORS_LIGHT = ['#059669', '#0284c7', '#0d9488', '#4f46e5'];

export const ParticleRibbons: React.FC<ParticleRibbonsProps> = ({ theme }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId = 0;
    let width = window.innerWidth || 1280;
    let height = window.innerHeight || 800;
    let isDark = theme === 'dark';
    let pulseCounter = 0;

    // Device-adaptive parameters for phone, tablet, and desktop comfort
    const getDeviceMetrics = (w: number, h: number) => {
      const isPhone = w < 640;
      const isTablet = w >= 640 && w < 1024;
      return {
        isPhone,
        isTablet,
        nodeCount: isPhone ? 26 : isTablet ? 40 : 54,
        interactionRadius: isPhone ? Math.min(185, Math.max(135, w * 0.44)) : isTablet ? 225 : 275,
        amplitudeScale: isPhone ? 0.56 : isTablet ? 0.78 : 1.0,
        stepPx: isPhone ? 12 : 16,
        gridSpacing: isPhone ? 44 : 56,
        maxDpr: isPhone ? 1.75 : 2,
        aspectVerticalBoost: h > w ? 1.15 : 1.0,
      };
    };

    let metrics = getDeviceMetrics(width, height);
    let nodes: MarketNode[] = [];
    const ripples: TouchRipple[] = [];
    const trail: TrailPoint[] = [];

    const seedNodes = (targetCount: number, w: number, h: number) => {
      const next: MarketNode[] = [];
      for (let i = 0; i < targetCount; i++) {
        const seed = (i + 1) * 137.508;
        next.push({
          x: ((Math.sin(seed) * 0.5 + 0.5) * 0.92 + 0.04) * w,
          y: ((Math.cos(seed * 0.73) * 0.5 + 0.5) * 0.92 + 0.04) * h,
          vx: Math.cos(seed * 1.3) * 0.28,
          vy: Math.sin(seed * 1.7) * 0.28,
          baseRadius: 1.6 + (i % 3) * 0.75,
          hueIndex: i % 4,
          phase: i * 0.9,
        });
      }
      nodes = next;
    };

    // Spring-tracked pointer & touch state
    const pointer = {
      x: width * 0.5,
      y: height * 0.36,
      targetX: width * 0.5,
      targetY: height * 0.36,
      vx: 0,
      vy: 0,
      presence: 0, // 0 = idle ambient, 1 = actively touched/hovered
      targetPresence: 0,
      lastActiveAt: 0,
    };

    const updateCanvasSize = () => {
      const vp = window.visualViewport;
      const nextW = Math.max(320, Math.round(vp?.width || window.innerWidth || 1280));
      const nextH = Math.max(480, Math.round(vp?.height || window.innerHeight || 800));
      metrics = getDeviceMetrics(nextW, nextH);
      const dpr = Math.min(window.devicePixelRatio || 1, metrics.maxDpr);

      width = nextW;
      height = nextH;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (nodes.length === 0) {
        seedNodes(metrics.nodeCount, width, height);
      } else {
        // Rescale existing nodes proportionally so resize/orientation changes never jump
        for (let i = 0; i < nodes.length; i++) {
          nodes[i].x = Math.min(width - 12, Math.max(12, nodes[i].x));
          nodes[i].y = Math.min(height - 12, Math.max(12, nodes[i].y));
        }
        if (nodes.length > metrics.nodeCount) {
          nodes.length = metrics.nodeCount;
        } else {
          while (nodes.length < metrics.nodeCount) {
            const idx = nodes.length;
            nodes.push({
              x: ((idx * 73) % Math.max(100, width - 40)) + 20,
              y: ((idx * 131) % Math.max(100, height - 40)) + 20,
              vx: (idx % 2 === 0 ? 1 : -1) * 0.25,
              vy: (idx % 3 === 0 ? 1 : -1) * 0.22,
              baseRadius: 1.7 + (idx % 3) * 0.65,
              hueIndex: idx % 4,
              phase: idx * 0.8,
            });
          }
        }
      }
    };

    const spawnRipple = (clientX: number, clientY: number, intensity = 1) => {
      const now = performance.now();
      ripples.push({
        x: clientX,
        y: clientY,
        bornAt: now,
        maxRadius: metrics.interactionRadius * (0.85 + 0.25 * intensity),
        intensity,
      });
      if (ripples.length > 8) ripples.shift();

      // Impart a gentle radial + tangential impulse to nearby constellation nodes
      const blastRadius = metrics.interactionRadius * 1.15;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const dx = n.x - clientX;
        const dy = n.y - clientY;
        const dist = Math.hypot(dx, dy);
        if (dist > 1 && dist < blastRadius) {
          const factor = (1 - dist / blastRadius) * 2.2 * intensity;
          const nx = dx / dist;
          const ny = dy / dist;
          n.vx += (nx * 0.75 - ny * 0.35) * factor;
          n.vy += (ny * 0.75 + nx * 0.35) * factor;
        }
      }

      pulseCounter += 1;
      container.setAttribute('data-touch-pulses', String(pulseCounter));
    };

    const engagePointer = (clientX: number, clientY: number, isImpact = false) => {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
      const now = performance.now();
      pointer.targetX = clientX;
      pointer.targetY = clientY;
      pointer.targetPresence = 1;
      pointer.lastActiveAt = now;
      container.setAttribute('data-pointer-active', 'true');

      if (
        trail.length === 0 ||
        Math.hypot(clientX - trail[trail.length - 1].x, clientY - trail[trail.length - 1].y) > 8
      ) {
        trail.push({ x: clientX, y: clientY, age: 0 });
        if (trail.length > 18) trail.shift();
      }

      if (isImpact) {
        spawnRipple(clientX, clientY, 1);
      }
    };

    const releasePointer = () => {
      pointer.lastActiveAt = performance.now();
    };

    const onPointerDown = (e: PointerEvent) => {
      engagePointer(e.clientX, e.clientY, true);
    };

    const onPointerMove = (e: PointerEvent) => {
      engagePointer(e.clientX, e.clientY, false);
    };

    const onPointerUp = () => {
      releasePointer();
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0] || e.changedTouches[0];
      if (t) engagePointer(t.clientX, t.clientY, true);
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) engagePointer(t.clientX, t.clientY, false);
    };

    const onTouchEnd = () => {
      releasePointer();
    };

    const drawRibbon = (ribbon: RibbonConfig, idx: number, time: number, interactive: boolean) => {
      ctx.beginPath();
      const step = metrics.stepPx;
      const baseAnchorY = height * ribbon.yAnchor;
      const amp = ribbon.amplitude * metrics.amplitudeScale * metrics.aspectVerticalBoost;
      const freq = ribbon.frequency * (metrics.isPhone ? 1.35 : 1.0);
      const radius = metrics.interactionRadius;

      for (let x = -step; x <= width + step; x += step) {
        const wave1 = Math.sin(x * freq + time * ribbon.speed + ribbon.phaseOffset) * amp;
        const wave2 =
          Math.cos(x * freq * 1.55 - time * ribbon.speed * 0.82 + idx * 1.1) * (amp * 0.42);
        const wave3 =
          Math.sin(x * 0.0045 + time * 0.00032 + idx) * (amp * 0.22);

        let y = baseAnchorY + wave1 + wave2 + wave3;

        if (interactive && pointer.presence > 0.01) {
          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < radius) {
            const pull = Math.pow(1 - dist / radius, 2) * pointer.presence;
            const rippleHarmonic = Math.sin(dist * 0.045 - time * 0.008) * 18 * pull;
            const velocityLift = Math.max(-36, Math.min(36, pointer.vy * 0.42)) * pull;
            y += (pointer.y - y) * pull * 0.42 + rippleHarmonic + velocityLift;
          }
        }

        // Also react to active expanding touch ripples
        for (let rIdx = 0; rIdx < ripples.length; rIdx++) {
          const rp = ripples[rIdx];
          const age = Math.max(0, time - rp.bornAt);
          const progress = Math.min(1, age / 1150);
          const currentR = rp.maxRadius * (1 - Math.pow(1 - progress, 3));
          const distToCenter = Math.hypot(x - rp.x, y - rp.y);
          const ringDelta = Math.abs(distToCenter - currentR);
          if (ringDelta < 54) {
            const waveStrength = (1 - ringDelta / 54) * (1 - progress) * 20;
            y += Math.sin((distToCenter - currentR) * 0.12) * waveStrength;
          }
        }

        if (x === -step) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      const activeBoost = pointer.presence * 0.45;
      ctx.strokeStyle =
        activeBoost > 0.12
          ? isDark
            ? ribbon.glowDark
            : ribbon.glowLight
          : isDark
            ? ribbon.colorDark
            : ribbon.colorLight;
      ctx.lineWidth = ribbon.thickness * (1 + pointer.presence * 0.28);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    };

    const drawSubtleGrid = () => {
      const spacing = metrics.gridSpacing;
      const radius = metrics.interactionRadius * 1.1;
      const baseAlpha = isDark ? 0.075 : 0.085;

      ctx.fillStyle = isDark ? `rgba(148, 163, 184, ${baseAlpha})` : `rgba(71, 85, 105, ${baseAlpha})`;

      for (let gx = spacing * 0.5; gx < width; gx += spacing) {
        for (let gy = spacing * 0.5; gy < height; gy += spacing) {
          let dotRadius = 1.0;
          if (pointer.presence > 0.02) {
            const d = Math.hypot(gx - pointer.x, gy - pointer.y);
            if (d < radius) {
              const boost = (1 - d / radius) * pointer.presence;
              dotRadius = 1.0 + boost * 1.65;
              ctx.fillStyle = isDark
                ? `rgba(56, 189, 248, ${0.12 + boost * 0.36})`
                : `rgba(5, 150, 105, ${0.12 + boost * 0.32})`;
              ctx.beginPath();
              ctx.arc(gx, gy, dotRadius, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = isDark
                ? `rgba(148, 163, 184, ${baseAlpha})`
                : `rgba(71, 85, 105, ${baseAlpha})`;
              continue;
            }
          }
          ctx.fillRect(gx - 0.6, gy - 0.6, 1.2, 1.2);
        }
      }
    };

    const drawFrame = (time: number, interactive: boolean) => {
      isDark = theme === 'dark' || document.documentElement.classList.contains('dark');
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';

      // Decay pointer presence gently after finger/mouse stops interacting (1.6s smooth tail)
      if (interactive) {
        const idleMs = time - pointer.lastActiveAt;
        if (idleMs > 1500) {
          pointer.targetPresence = 0;
          container.setAttribute('data-pointer-active', 'false');
        }
        const prevX = pointer.x;
        const prevY = pointer.y;
        pointer.x += (pointer.targetX - pointer.x) * 0.16;
        pointer.y += (pointer.targetY - pointer.y) * 0.16;
        pointer.vx = pointer.x - prevX;
        pointer.vy = pointer.y - prevY;
        pointer.presence += (pointer.targetPresence - pointer.presence) * 0.09;
      }

      // 1. Subtle interactive coordinate matrix dot grid
      drawSubtleGrid();

      // 2. Ambient & Touch-Reactive Spotlight Aura (works in both Light and Dark mode)
      const auraX = pointer.presence > 0.02 ? pointer.x : width * 0.5;
      const auraY = pointer.presence > 0.02 ? pointer.y : height * 0.32;
      const auraRadius = metrics.interactionRadius * (1.2 + pointer.presence * 0.35);
      const aura = ctx.createRadialGradient(auraX, auraY, 8, auraX, auraY, auraRadius);
      if (isDark) {
        const alpha1 = 0.09 + pointer.presence * 0.11;
        const alpha2 = 0.05 + pointer.presence * 0.06;
        aura.addColorStop(0, `rgba(16, 185, 129, ${alpha1})`);
        aura.addColorStop(0.52, `rgba(56, 189, 248, ${alpha2})`);
        aura.addColorStop(1, 'rgba(15, 23, 42, 0)');
      } else {
        const alpha1 = 0.08 + pointer.presence * 0.10;
        const alpha2 = 0.05 + pointer.presence * 0.06;
        aura.addColorStop(0, `rgba(16, 185, 129, ${alpha1})`);
        aura.addColorStop(0.55, `rgba(2, 132, 199, ${alpha2})`);
        aura.addColorStop(1, 'rgba(248, 250, 252, 0)');
      }
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(auraX, auraY, auraRadius, 0, Math.PI * 2);
      ctx.fill();

      // 3. Flowing Market Data Ribbons
      for (let i = 0; i < RIBBONS.length; i++) {
        drawRibbon(RIBBONS[i], i, time, interactive);
      }

      // 4. Touch / Pointer Luminous Spline Trail
      if (interactive && trail.length > 1) {
        for (let i = trail.length - 1; i >= 0; i--) {
          trail[i].age += 1;
          if (trail[i].age > 24) {
            trail.splice(i, 1);
          }
        }
        if (trail.length > 1) {
          for (let i = 1; i < trail.length; i++) {
            const p0 = trail[i - 1];
            const p1 = trail[i];
            const life = Math.max(0, 1 - p1.age / 24);
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.strokeStyle = isDark
              ? `rgba(56, 189, 248, ${life * 0.38})`
              : `rgba(5, 150, 105, ${life * 0.28})`;
            ctx.lineWidth = life * 3.2;
            ctx.lineCap = 'round';
            ctx.stroke();
          }
        }
      }

      // 5. Interactive Constellation Nodes & Touch Telemetry Tethers
      const palette = isDark ? NODE_COLORS_DARK : NODE_COLORS_LIGHT;
      const connectDist = metrics.isPhone ? 92 : 118;
      const touchRadius = metrics.interactionRadius;

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (interactive) {
          n.x += n.vx;
          n.y += n.vy;

          // Gentle damping back toward steady drift speed
          n.vx *= 0.985;
          n.vy *= 0.985;
          const speed = Math.hypot(n.vx, n.vy);
          if (speed < 0.18) {
            n.vx += Math.cos(time * 0.001 + n.phase) * 0.012;
            n.vy += Math.sin(time * 0.001 + n.phase) * 0.012;
          }

          // Soft boundary bounce
          if (n.x < 12) { n.x = 12; n.vx = Math.abs(n.vx); }
          if (n.x > width - 12) { n.x = width - 12; n.vx = -Math.abs(n.vx); }
          if (n.y < 12) { n.y = 12; n.vy = Math.abs(n.vy); }
          if (n.y > height - 12) { n.y = height - 12; n.vy = -Math.abs(n.vy); }

          // Magnetic touch / pointer attraction + subtle orbital swirl
          if (pointer.presence > 0.02) {
            const dx = pointer.x - n.x;
            const dy = pointer.y - n.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 8 && dist < touchRadius) {
              const influence = (1 - dist / touchRadius) * pointer.presence;
              const nx = dx / dist;
              const ny = dy / dist;
              // Attract gently while swirling tangentially around the finger/cursor
              n.vx += (nx * 0.09 - ny * 0.055) * influence;
              n.vy += (ny * 0.09 + nx * 0.055) * influence;

              // Draw live telemetry tether from node to touch/cursor
              ctx.beginPath();
              ctx.moveTo(n.x, n.y);
              ctx.lineTo(pointer.x, pointer.y);
              ctx.strokeStyle = isDark
                ? `rgba(16, 185, 129, ${influence * 0.34})`
                : `rgba(5, 150, 105, ${influence * 0.26})`;
              ctx.lineWidth = 0.85 + influence * 0.8;
              ctx.stroke();
            }
          }
        }

        // Connect neighboring nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const d = Math.hypot(n.x - m.x, n.y - m.y);
          if (d < connectDist) {
            const lineAlpha = (1 - d / connectDist) * (isDark ? 0.16 : 0.13);
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.strokeStyle = isDark
              ? `rgba(148, 163, 184, ${lineAlpha})`
              : `rgba(71, 85, 105, ${lineAlpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }

        // Draw node core
        const pulse = 1 + Math.sin(time * 0.003 + n.phase) * 0.22;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.baseRadius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = palette[n.hueIndex];
        ctx.globalAlpha = isDark ? 0.68 : 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // 6. Expanding Touch / Tap Sonar Ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        const age = time - rp.bornAt;
        if (age > 1150) {
          ripples.splice(i, 1);
          continue;
        }
        const progress = Math.max(0, Math.min(1, age / 1150));
        const eased = 1 - Math.pow(1 - progress, 3);
        const r1 = Math.max(2, rp.maxRadius * eased);
        const r2 = Math.max(1, r1 * 0.62);
        const alpha = Math.pow(1 - progress, 1.65) * (isDark ? 0.48 : 0.36);

        ctx.beginPath();
        ctx.arc(rp.x, rp.y, r1, 0, Math.PI * 2);
        ctx.strokeStyle = isDark
          ? `rgba(16, 185, 129, ${alpha})`
          : `rgba(5, 150, 105, ${alpha})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(rp.x, rp.y, r2, 0, Math.PI * 2);
        ctx.strokeStyle = isDark
          ? `rgba(56, 189, 248, ${alpha * 0.75})`
          : `rgba(2, 132, 199, ${alpha * 0.75})`;
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
    };

    updateCanvasSize();

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      drawFrame(1200, false);
      const handleStaticResize = () => {
        updateCanvasSize();
        drawFrame(1200, false);
      };
      window.addEventListener('resize', handleStaticResize, { passive: true });
      return () => {
        window.removeEventListener('resize', handleStaticResize);
      };
    }

    const animate = (timestamp: number) => {
      drawFrame(timestamp, true);
      animationFrameId = window.requestAnimationFrame(animate);
    };

    animationFrameId = window.requestAnimationFrame(animate);

    window.addEventListener('resize', updateCanvasSize, { passive: true });
    window.visualViewport?.addEventListener('resize', updateCanvasSize, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', updateCanvasSize);
      window.visualViewport?.removeEventListener('resize', updateCanvasSize);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [theme]);

  return (
    <div
      ref={containerRef}
      data-testid="landing-live-background"
      data-theme={theme}
      data-touch-pulses="0"
      data-pointer-active="false"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Dual-theme ambient depth mesh */}
      <div
        className={`absolute -top-[14%] -left-[10%] w-[68vw] max-w-[680px] h-[48vh] max-h-[520px] rounded-full blur-[110px] transition-opacity duration-700 ${
          theme === 'dark'
            ? 'bg-emerald-500/[0.11] opacity-100'
            : 'bg-emerald-500/[0.10] opacity-90'
        }`}
      />
      <div
        className={`absolute top-[18%] -right-[12%] w-[62vw] max-w-[620px] h-[46vh] max-h-[500px] rounded-full blur-[120px] transition-opacity duration-700 ${
          theme === 'dark'
            ? 'bg-sky-500/[0.10] opacity-100'
            : 'bg-sky-500/[0.09] opacity-90'
        }`}
      />
      <div
        className={`absolute -bottom-[12%] left-[18%] w-[64vw] max-w-[640px] h-[42vh] max-h-[460px] rounded-full blur-[120px] transition-opacity duration-700 ${
          theme === 'dark'
            ? 'bg-indigo-500/[0.09] opacity-100'
            : 'bg-indigo-500/[0.07] opacity-85'
        }`}
      />
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};
