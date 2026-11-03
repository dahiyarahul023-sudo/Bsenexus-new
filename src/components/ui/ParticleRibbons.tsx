import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * ParticleRibbons — Scroll-Interactive Dynamic Ambient Lighting & Plexus System
 * 
 * Features:
 * - Dynamic Scroll-Tracking Spotlight: Glides smoothly down the page as the user scrolls,
 *   illuminating the active viewport section (Hero -> Catalysts -> Results -> Bento -> Pricing -> Community)
 * - Section-Aware Chromatic Shifts: Colors morph organically from Cyan -> Emerald -> Royal Blue -> Violet -> Teal
 * - Mobile Touch Support: Touch gestures smoothly attract the spotlight to user interaction points
 * - Interactive Button/Card Magnetism: When hovering or tapping buttons, the ambient light eases in and expands
 * - Continuous S-curve phase independent of scroll velocity and browser chrome
 * - Adaptive Light & Dark mode: Luminous bloom in dark mode; soft crystalline opalescent watercolor glazes in light mode
 */
export default function ParticleRibbons() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const reducedMotion = prefersReducedMotion;
    const isDark = () => document.documentElement.classList.contains('dark');

    // Pointer and scroll state
    const mouse = { x: -9999, y: -9999, sx: -9999, sy: -9999 };
    let scrollY = 0;
    let smoothScrollY = 0;
    let animationTime = 0;
    let previousDrawTime: number | null = null;

    type Ribbon = {
      arc: boolean; angle: number; reach: number; yBase: number;
      hue: number; sat: number; light: number;
      speed: number; phase: number; amp: number; freq: number;
      width: number; alpha: number; bend: number;
    };
    type Node = { x: number; y: number; vx: number; vy: number; r: number };
    type Spark = { x: number; y: number; vx: number; vy: number; r: number; ph: number; sp: number };

    let ribbons: Ribbon[] = [];
    let nodes: Node[] = [];
    let sparks: Spark[] = [];

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const pickHue = () => {
      const r = Math.random();
      if (r < 0.4) return { h: rand(185, 205), s: 95, l: 60 }; // Cyan/Azure
      if (r < 0.7) return { h: rand(150, 175), s: 85, l: 55 }; // Emerald/Teal
      if (r < 0.88) return { h: rand(215, 240), s: 90, l: 65 }; // Royal Blue
      return { h: rand(260, 280), s: 90, l: 65 }; // Violet
    };

    const build = () => {
      const isMobile = w < 640;
      const count = isMobile ? 5 : 9;
      ribbons = [];
      for (let i = 0; i < count; i++) {
        const c = pickHue();
        ribbons.push({
          arc: Math.random() < 0.65,
          angle: rand(-0.5, 1.5),
          reach: rand(0.55, 1.25),
          yBase: rand(0.05, 0.95),
          hue: c.h,
          sat: c.s,
          light: c.l,
          speed: rand(0.2, 0.55),
          phase: rand(0, Math.PI * 2),
          amp: rand(14, 40),
          freq: rand(1.5, 3.2),
          width: rand(1.0, 2.2),
          alpha: rand(0.35, 0.8),
          bend: rand(-0.9, 0.9),
        });
      }

      nodes = [];
      const nn = isMobile ? 8 : 16;
      for (let i = 0; i < nn; i++) {
        nodes.push({ x: rand(0, w), y: rand(0, h), vx: rand(-12, 12), vy: rand(-10, 10), r: rand(1.2, 2.4) });
      }

      sparks = [];
      const sn = isMobile ? 10 : 22;
      for (let i = 0; i < sn; i++) {
        sparks.push({ 
          x: rand(0, w), 
          y: rand(0, h), 
          vx: rand(-8, 12), 
          vy: rand(-8, 8), 
          r: rand(0.8, 2.0), 
          ph: rand(0, Math.PI * 2), 
          sp: rand(0.8, 2.2) 
        });
      }
    };

    const resize = () => {
      const previousWidth = w, previousHeight = h;
      w = Math.max(1, window.innerWidth);
      // Mobile browser chrome resizes innerHeight during a scroll. Keep a
      // stable layout viewport so that revealing the address bar cannot rebuild
      // or stretch every ribbon mid-gesture.
      h = w < 640 && previousWidth === w ? previousHeight : Math.max(1, document.documentElement.clientHeight, w < 640 ? window.screen.height : 0);
      const isMobile = w < 640;
      dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!previousWidth) build();
      else {
        for (const point of [...nodes, ...sparks]) {
          point.x *= w / previousWidth;
          point.y *= h / previousHeight;
        }
      }
      if (reducedMotion && previousWidth) draw(1000);
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Mouse & Touch Tracking
    const onMouse = (e: MouseEvent) => { 
      mouse.x = e.clientX; 
      mouse.y = e.clientY; 
    };
    window.addEventListener('mousemove', onMouse, { passive: true });
    // Touch scrolling does not attract the light toward a moving finger.

    // Scroll Tracking
    const onScroll = () => {
      scrollY = window.scrollY || window.pageYOffset;

    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    let lastFrame = 0;
    const onVis = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      previousDrawTime = null;
      if (!document.hidden && !reducedMotion) raf = requestAnimationFrame(loop);
    };
    document.addEventListener('visibilitychange', onVis);

    const SEG = 24;

    const ribbonPoint = (r: Ribbon, t: number, k: number, bx: number, by: number): [number, number] => {
      const tt = t * r.speed + r.phase;
      if (r.arc) {
        const ang = r.angle + Math.sin(tt * 0.6) * 0.28;
        const len = Math.max(w, h) * 0.9 * r.reach;
        const ex = bx + Math.cos(ang) * len;
        const ey = by + Math.sin(ang) * len;
        const bendAmt = r.bend * len * 0.35;
        const cx = (bx + ex) / 2 + Math.cos(ang + Math.PI / 2) * bendAmt + Math.sin(tt * 0.8) * 46;
        const cy = (by + ey) / 2 + Math.sin(ang + Math.PI / 2) * bendAmt + Math.cos(tt * 0.7) * 46;
        const mt = k * k * (3 - 2 * k);
        const x = (1 - mt) * (1 - mt) * bx + 2 * (1 - mt) * mt * cx + mt * mt * ex;
        const y = (1 - mt) * (1 - mt) * by + 2 * (1 - mt) * mt * cy + mt * mt * ey;
        const px = -(ey - by), py = ex - bx;
        const pl = Math.hypot(px, py) || 1;
        const wave = Math.sin(k * Math.PI * r.freq + tt * 2.2) * r.amp * Math.sin(k * Math.PI);
        return [x + (px / pl) * wave, y + (py / pl) * wave];
      }
      const x = k * (w + 200) - 100;
      const y = r.yBase * h + Math.sin(k * Math.PI * r.freq + tt * 1.8) * r.amp
        + Math.sin(k * Math.PI * 2.3 + tt) * r.amp * 0.35;
      return [x, y];
    };

    const draw = (time: number) => {
      const delta = previousDrawTime === null ? 0 : Math.min(50, Math.max(0, time - previousDrawTime));
      previousDrawTime = time;
      animationTime += delta / 1000;
      const t = animationTime;
      const step = reducedMotion ? 0 : delta / 1000;
      const ease = reducedMotion ? 1 : 1 - Math.exp(-step * 6);
      const dark = isDark();

      // Smooth scroll smoothing
      smoothScrollY += (scrollY - smoothScrollY) * ease;
      const currentScrollRatio = Math.min(1, Math.max(0, smoothScrollY / (document.documentElement.scrollHeight - window.innerHeight || 1)));

      // Dynamic scroll beam position:
      // Glides along an S-curve across the viewport height based on scroll progression
      const scrollBeamX = w * (0.5 + 0.35 * Math.sin(currentScrollRatio * Math.PI * 2.5 + t * 0.3));
      const scrollBeamY = h * (0.25 + 0.5 * Math.sin(currentScrollRatio * Math.PI * 1.8 + 0.2));

      // Ease spotlight toward active interaction or scroll beam
      const targetSpotX = mouse.x > -100 ? mouse.x : scrollBeamX;
      const targetSpotY = mouse.y > -100 ? mouse.y : scrollBeamY;

      if (mouse.sx < -100) { mouse.sx = targetSpotX; mouse.sy = targetSpotY; }
      mouse.sx += (targetSpotX - mouse.sx) * ease;
      mouse.sy += (targetSpotY - mouse.sy) * ease;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 1. DYNAMIC SCROLL SPOTLIGHT BEAM (Tracks scroll and expands near buttons/cards)
      // Color dynamically adapts to page zone:
      // Zone 1: Cyan (Hero) -> Zone 2: Emerald (Catalysts) -> Zone 3: Royal Blue (Results) -> Zone 4: Purple (Bento) -> Zone 5: Emerald (Pricing)
      let beamHue = 195; // default Cyan
      if (currentScrollRatio < 0.2) {
        beamHue = 195; // Hero
      } else if (currentScrollRatio < 0.45) {
        beamHue = 160; // Catalysts (Emerald)
      } else if (currentScrollRatio < 0.70) {
        beamHue = 220; // Results (Blue)
      } else if (currentScrollRatio < 0.88) {
        beamHue = 270; // Bento (Purple)
      } else {
        beamHue = 165; // Pricing & Community (Teal/Emerald)
      }

      const isInteracting = mouse.x > -100;
      const baseRadius = Math.min(w, h) * (isInteracting ? 0.38 : 0.48);
      const pulseRadius = baseRadius * (1 + 0.08 * Math.sin(t * 1.5));

      // Outer ambient spotlight wash
      const spotGrad = ctx.createRadialGradient(mouse.sx, mouse.sy, 0, mouse.sx, mouse.sy, pulseRadius);
      const spotAlpha = dark ? (isInteracting ? 0.18 : 0.12) : (isInteracting ? 0.09 : 0.06);
      spotGrad.addColorStop(0, `hsla(${beamHue}, 90%, ${dark ? 65 : 55}%, ${spotAlpha})`);
      spotGrad.addColorStop(0.5, `hsla(${beamHue + 20}, 85%, ${dark ? 60 : 50}%, ${spotAlpha * 0.5})`);
      spotGrad.addColorStop(1, `hsla(${beamHue}, 90%, 60%, 0)`);
      ctx.fillStyle = spotGrad;
      ctx.fillRect(mouse.sx - pulseRadius, mouse.sy - pulseRadius, pulseRadius * 2, pulseRadius * 2);

      // Core focused beam
      const coreR = pulseRadius * 0.35;
      const coreGrad = ctx.createRadialGradient(mouse.sx, mouse.sy, 0, mouse.sx, mouse.sy, coreR);
      coreGrad.addColorStop(0, `hsla(${beamHue - 15}, 100%, ${dark ? 75 : 60}%, ${dark ? 0.22 : 0.10})`);
      coreGrad.addColorStop(1, `hsla(${beamHue}, 100%, 75%, 0)`);
      ctx.fillStyle = coreGrad;
      ctx.fillRect(mouse.sx - coreR, mouse.sy - coreR, coreR * 2, coreR * 2);

      // 2. Secondary Floating Glow Burst Point (Slow lissajous drift)
      const burstX = w * (0.5 + 0.3 * Math.sin(t * 0.12 + currentScrollRatio * 2));
      const burstY = h * (0.4 + 0.28 * Math.sin(t * 0.08 + 1.2));
      const burstR = Math.min(w, h) * 0.15;
      const bg = ctx.createRadialGradient(burstX, burstY, 0, burstX, burstY, burstR);
      const bAlpha = dark ? 0.25 : 0.08;
      bg.addColorStop(0, `hsla(180, 95%, 65%, ${bAlpha})`);
      bg.addColorStop(1, 'hsla(180, 95%, 65%, 0)');
      ctx.fillStyle = bg;
      ctx.fillRect(burstX - burstR, burstY - burstR, burstR * 2, burstR * 2);

      // 3. Ribbons (Velocity-boosted on scroll)
      const heads: Array<[number, number, number]> = [];
      // Integrate elapsed frame time once; scrolling never changes ribbon phase.

      for (const r of ribbons) {
        const passes = dark ? [{ m: 3.8, a: 0.14 }, { m: 1, a: 0.9 }] : [{ m: 2.2, a: 0.12 }];
        const points = Array.from({ length: SEG + 1 }, (_, s) => 
          ribbonPoint(r, t, s / SEG, burstX, burstY)
        );

        for (const p of passes) {
          for (let s = 1; s <= SEG; s++) {
            const k1 = s / SEG;
            const [x0, y0] = points[s - 1];
            const [x1, y1] = points[s];
            const fade = Math.pow(1 - k1, 1.5);
            const a = r.alpha * fade * p.a * (dark ? 1 : 0.45);
            if (a < 0.003) continue;
            ctx.strokeStyle = `hsla(${r.hue}, ${r.sat}%, ${dark ? r.light : Math.max(35, r.light - 16)}%, ${a})`;
            ctx.lineWidth = Math.max(0.5, r.width * p.m * (0.6 + fade * 0.6));
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
          }
        }
        const [hx, hy] = ribbonPoint(r, t, 0.02, burstX, burstY);
        heads.push([hx, hy, r.hue]);
        ctx.fillStyle = `hsla(${r.hue}, 100%, ${dark ? 80 : 55}%, ${r.alpha * (dark ? 0.85 : 0.4)})`;
        ctx.beginPath();
        ctx.arc(hx, hy, r.width * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Plexus Network
      const LINK = w < 640 ? 110 : 140;
      for (const n of nodes) {
        n.x += n.vx * step;
        n.y += n.vy * step;
        if (n.x < -20) n.x = w + 20; if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20; if (n.y > h + 20) n.y = -20;
      }
      const linkAlpha = dark ? 0.15 : 0.08;
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const al = linkAlpha * (1 - Math.sqrt(d2) / LINK);
            ctx.strokeStyle = `hsla(${beamHue}, 85%, ${dark ? 65 : 45}%, ${al})`;
            ctx.beginPath(); 
            ctx.moveTo(a.x, a.y); 
            ctx.lineTo(b.x, b.y); 
            ctx.stroke();
          }
        }
        // Connect to nearby ribbon heads
        for (const [hx, hy, hue] of heads) {
          const dx = a.x - hx, dy = a.y - hy;
          const d2 = dx * dx + dy * dy;
          const R = LINK * 0.85;
          if (d2 < R * R) {
            const al = (dark ? 0.25 : 0.12) * (1 - Math.sqrt(d2) / R);
            ctx.strokeStyle = `hsla(${hue}, 90%, ${dark ? 66 : 45}%, ${al})`;
            ctx.beginPath(); 
            ctx.moveTo(a.x, a.y); 
            ctx.lineTo(hx, hy); 
            ctx.stroke();
          }
        }
        ctx.fillStyle = `hsla(${beamHue}, 90%, ${dark ? 70 : 50}%, ${dark ? 0.5 : 0.3})`;
        ctx.beginPath(); 
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); 
        ctx.fill();
      }

      // 5. Sparkle Dust
      for (const s of sparks) {
        s.x += s.vx * step;
        s.y += s.vy * step;
        if (s.x < -10) s.x = w + 10; if (s.x > w + 10) s.x = -10;
        if (s.y < -10) s.y = h + 10; if (s.y > h + 10) s.y = -10;
        const tw = 0.25 + 0.75 * Math.abs(Math.sin(t * s.sp + s.ph));
        ctx.fillStyle = `hsla(${beamHue}, 90%, ${dark ? 75 : 45}%, ${tw * (dark ? 0.45 : 0.22)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
    };

    if (reducedMotion) {
      draw(1000);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVis);
      const themeObserver = new MutationObserver(() => draw(1000));
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      return () => { window.removeEventListener('resize', resize); themeObserver.disconnect(); };
    }

    const loop = (time: number) => {
      if (document.hidden) { raf = 0; return; }
      if (time - lastFrame >= 1000 / 30) { 
        draw(time); 
        lastFrame = time; 
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [prefersReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1] h-full w-full"
    />
  );
}
