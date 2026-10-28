import React, { useEffect, useRef } from 'react';
export function ScrollProgressBar() {
  const fill = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (document.body.style.position === 'fixed') return;
      const root = document.scrollingElement || document.documentElement;
      const range = root.scrollHeight - root.clientHeight;
      const ratio = range > 0 ? Math.min(1, Math.max(0, root.scrollTop / range)) : 0;
      if (fill.current) fill.current.style.transform = `scaleX(${ratio})`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement); observer.observe(document.body);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule); window.addEventListener('pageshow', schedule);
    window.visualViewport?.addEventListener('resize', schedule); schedule();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule);
      window.removeEventListener('pageshow', schedule); window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, []);
  return <div className="fixed top-0 left-0 right-0 h-[2.5px] z-50 pointer-events-none overflow-hidden bg-transparent" aria-hidden="true">
    <div ref={fill} className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 origin-left" style={{ transform: 'scaleX(0)' }} />
  </div>;
}
