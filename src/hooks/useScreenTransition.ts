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
      if (!page || page.querySelector('.loading-skeleton')) return false;
      // Keep directional motion without synchronous style/layout reads over
      // the destination tree. Child order is already the reading order.
      const surfaces = Array.from(page.children).filter((node): node is HTMLElement =>
        node instanceof HTMLElement && !node.hidden && !node.matches('[role="dialog"], [role="status"]'));
      (surfaces.length ? surfaces.slice(0, 12) : [page]).forEach((surface, index) => {
        animations.push(surface.animate([
          { transform: 'translateX(-8px)', opacity: 0.85 },
          { transform: 'translateX(0)', opacity: 1 },
        ], { duration: 180, delay: Math.min(index * 20, 80), easing: 'ease-out' }));
      });
      return true;
    };
    frame = requestAnimationFrame(() => {
      if (!reveal()) {
        observer = new MutationObserver(() => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => { if (reveal()) observer?.disconnect(); });
        });
        observer.observe(root, { childList: true, subtree: true });
      }
    });
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      animations.forEach(animation => animation.cancel());
      delete root.dataset.screenMotionRoot;
    };
  }, [displayedKey, reducedMotion, mode]);

  return { ref, displayedKey, reducedMotion };
}
