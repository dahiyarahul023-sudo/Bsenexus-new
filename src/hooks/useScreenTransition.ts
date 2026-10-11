import { useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

type ScreenKey = string | null;

/** Retains page instances and visible content; navigation never adds a blank frame. */
export function useScreenTransition<T extends ScreenKey>(requestedKey: T, mode: 'page' | 'section' = 'page') {
  const [displayedKey, setDisplayedKey] = useState(requestedKey);
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const previousKey = useRef(requestedKey);
  const entered = useRef(false);
  const focusOnEntry = useRef(false);

  useLayoutEffect(() => {
    const root = ref.current;
    if (requestedKey === displayedKey) return;
    const shouldFocus = !!root?.contains(document.activeElement);
    focusOnEntry.current = focusOnEntry.current || shouldFocus;
    // Commit before paint. Never fade the whole screen out: the next page's
    // real content or its Suspense skeleton must be visible on every frame.
    setDisplayedKey(requestedKey);
  }, [requestedKey, displayedKey, reducedMotion, mode]);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.inert = false;
    const changed = previousKey.current !== displayedKey;
    previousKey.current = displayedKey;
    if (focusOnEntry.current) {
      root.focus({ preventScroll: true });
      focusOnEntry.current = false;
    }
    if (reducedMotion || typeof root.animate !== 'function' || (!changed && entered.current)) return;
    entered.current = true;
    const animations: Animation[] = [];
    root.dataset.screenMotionRoot = mode;
    let observer: MutationObserver | undefined;
    let frame = 0;

    const reveal = () => {
      const page = mode === 'page'
        ? root.querySelector<HTMLElement>('[data-screen-page]:not([hidden])')
        : root;
      if (!page) return false;
      const surfaces: HTMLElement[] = [];
      // Partition the visible layout into independent surfaces. Never animate
      // both a container and its descendants (which doubles the movement).
      const collect = (parent: Element, depth: number) => {
        for (const child of Array.from(parent.children)) {
          if (!(child instanceof HTMLElement) || surfaces.length >= 24) continue;
          if (child.matches('[hidden], [role="dialog"], [role="status"], .loading-skeleton, [data-screen-motion-root]')) continue;
          const style = getComputedStyle(child);
          const rect = child.getBoundingClientRect();
          if (!child.getClientRects().length || style.visibility === 'hidden' || style.display === 'none'
            || style.position === 'fixed' || style.position === 'sticky'
            || rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
          const isControl = child.matches('button, input, select, textarea, a');
          const isRowGroup = child.children.length > 1
            && Array.from(child.children).filter(node => node.matches('button, article, [data-motion-item]')).length > 1;
          const isSurface = !isRowGroup && (child.matches('h1,h2,h3,h4,p,article,[data-motion-item]')
            || child.className.includes('rounded'));
          if ((isSurface || isControl || depth >= 5 || !child.children.length)
            && rect.height < window.innerHeight * 1.25
            && !child.querySelector('[role="dialog"], .fixed, .sticky, [data-screen-motion-root]')) {
            surfaces.push(child);
          } else collect(child, depth + 1);
        }
      };
      collect(page, 0);
      if (!surfaces.length) return false;

      // Group by visual row, then order left to right. On a single-column
      // phone layout this naturally becomes the top-to-bottom reading order.
      const remaining = surfaces.map(node => ({ node, rect: node.getBoundingClientRect() }))
        .sort((a, b) => a.rect.top - b.rect.top);
      const ordered: HTMLElement[] = [];
      while (remaining.length) {
        const top = remaining[0].rect.top;
        const row = remaining.filter(item => Math.abs(item.rect.top - top) < 24);
        row.sort((a, b) => a.rect.left - b.rect.left);
        ordered.push(...row.map(item => item.node));
        row.forEach(item => remaining.splice(remaining.indexOf(item), 1));
      }
      ordered.forEach((surface, index) => {
        animations.push(surface.animate([
          { translate: '-8px 0', opacity: 0.72 },
          { translate: '0 0', opacity: 1 },
        ], {
          duration: 280, delay: Math.min(index * 35, 175),
          easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards',
        }));
      });
      return true;
    };

    // Lazy destinations can mount after the navigation commit. Animate their
    // first real content too, without replaying on live data or user edits.
    if (!reveal()) {
      observer = new MutationObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (reveal()) observer?.disconnect();
        });
      });
      observer.observe(root, { childList: true, subtree: true });
    }
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      animations.forEach(animation => animation.cancel());
      delete root.dataset.screenMotionRoot;
    };
  }, [displayedKey, reducedMotion, mode]);

  return { ref, displayedKey, reducedMotion };
}
