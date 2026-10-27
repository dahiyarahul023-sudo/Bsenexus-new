import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/** Escape transformed/blurred card containing blocks; keep actions inside the viewport. */
export function AnchoredPopover({ anchorRef, onClose, children, label }: {
  anchorRef: RefObject<HTMLDivElement | null>; onClose: () => void; children: ReactNode; label: string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const [position, setPosition] = useState({ top: 12, left: 12, maxHeight: 400 });
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const place = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const menu = menuRef.current;
      if (!anchor || !menu) return;
      const width = Math.min(256, window.innerWidth - 24);
      const height = Math.min(menu.scrollHeight, window.innerHeight - 24);
      const below = window.innerHeight - anchor.bottom - 12;
      const top = below >= height ? anchor.bottom + 6 : Math.max(12, anchor.top - height - 6);
      setPosition({ top, left: Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12)), maxHeight: window.innerHeight - top - 12 });
    };
    place();
    menuRef.current?.querySelector<HTMLElement>('button,a[href]')?.focus({ preventScroll: true });
    const keyboard = (event: KeyboardEvent) => {
      if (!menuRef.current?.contains(document.activeElement)) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      event.stopPropagation();
      const controls = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]') || []);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) return;
      if (!controls.includes(document.activeElement as HTMLElement)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('keydown', keyboard, true);
    return () => {
      window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); window.removeEventListener('keydown', keyboard, true);
      if (previous?.isConnected && (!document.activeElement || document.activeElement === document.body || menuRef.current?.contains(document.activeElement))) previous.focus({ preventScroll: true });
    };
  }, [anchorRef]);
  return createPortal(
    <div className="calendar-popover-backdrop fixed inset-0 z-[9998]" onClick={event => { event.stopPropagation(); onClose(); }}>
      <div ref={menuRef} role="dialog" aria-label={label} aria-modal="true"
        className="calendar-action-popover fixed overflow-y-auto border rounded-2xl p-2 space-y-1 shadow-xl"
        style={{ ...position, width: 'min(256px, calc(100vw - 24px))' }}
        onClick={event => event.stopPropagation()}>
        {children}
      </div>
    </div>, document.body
  );
}
