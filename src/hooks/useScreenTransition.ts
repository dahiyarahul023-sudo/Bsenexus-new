import { useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

type ScreenKey = string | null;

/** Retains page instances; only presentation changes when navigation commits. */
export function useScreenTransition<T extends ScreenKey>(requestedKey: T, mode: 'page' | 'section' = 'page') {
  const [displayedKey, setDisplayedKey] = useState(requestedKey);
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const previousKey = useRef(requestedKey);
  const entered = useRef(false);
  const focusOnEntry = useRef(false);
  const direction = useRef(1);

  useLayoutEffect(() => {
    const root = ref.current;
    if (requestedKey === displayedKey) return;
    const shouldFocus = !!root?.contains(document.activeElement);
    focusOnEntry.current = focusOnEntry.current || shouldFocus;
    direction.current = mode === 'section' && requestedKey === null ? -1 : 1;
    if (!root || reducedMotion || typeof root.animate !== 'function') {
      setDisplayedKey(requestedKey);
      return;
    }
    // Inactive content must not remain clickable during the brief exit.
    root.inert = true;
    const exit = root.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 90, easing: 'ease-in', fill: 'forwards',
    });
    const timer = window.setTimeout(() => setDisplayedKey(requestedKey), 90);
    return () => {
      window.clearTimeout(timer);
      exit.cancel();
      root.inert = false;
    };
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
    const animations: Animation[] = [root.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 260, easing: 'cubic-bezier(.22,1,.36,1)',
    })];
    const page = mode === 'page'
      ? root.querySelector<HTMLElement>('[data-screen-page]:not([hidden])')?.firstElementChild
      : root.firstElementChild ?? root;
    // A transform on a fixed/sticky ancestor changes its containing block.
    // Animate only a few safe visible surfaces, never the app shell or dialogs.
    const surfaces = Array.from(page?.children ?? []).filter((node): node is HTMLElement => {
      if (!(node instanceof HTMLElement)) return false;
      const position = getComputedStyle(node).position;
      return node.getClientRects().length > 0 && position !== 'fixed' && position !== 'sticky'
        && !node.querySelector('[role="dialog"], .fixed, .sticky')
        && node.getBoundingClientRect().height < window.innerHeight * 1.25;
    }).slice(0, 5);
    surfaces.forEach((surface, index) => {
      const offset = mode === 'section' ? `${direction.current * 12}px 0` : '0 8px';
      animations.push(surface.animate([
        { opacity: 0, translate: offset }, { opacity: 1, translate: '0 0' },
      ], { duration: 320, delay: index * 35, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }));
    });
    return () => animations.forEach(animation => animation.cancel());
  }, [displayedKey, reducedMotion, mode]);

  return { ref, displayedKey, reducedMotion };
}
