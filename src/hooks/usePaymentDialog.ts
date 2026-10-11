import { useEffect, useRef } from 'react';
import { useBodyScrollLock } from './useBodyScrollLock';

const dialogs: symbol[] = [];
/** Payment dialogs own focus and keyboard space; nested dialogs restore their parent. */
export function usePaymentDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const id = Symbol('payment-dialog');
    dialogs.push(id);
    const previous = document.activeElement as HTMLElement | null;
    const element = ref.current;
    const viewport = window.visualViewport;
    const resize = () => {
      element?.style.setProperty('--payment-height', `${viewport?.height ?? window.innerHeight}px`);
      element?.style.setProperty('--payment-top', `${viewport?.offsetTop ?? 0}px`);
    };
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    const focusable = () => Array.from(element?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), summary, [tabindex="0"]') ?? []).filter(el => el.getClientRects().length > 0);
    focusable()[0]?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (dialogs[dialogs.length - 1] !== id) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (!items.includes(document.activeElement as HTMLElement) || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      dialogs.splice(dialogs.indexOf(id), 1);
      document.removeEventListener('keydown', key, true);
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);
  return ref;
}
