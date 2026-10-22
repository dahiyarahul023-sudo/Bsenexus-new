import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

/** Native modal owns inert background, keyboard containment and immediate mobile focus. */
export function RadarWindow({ onClose, onBack, detailKey, children, returnFocus }: {
  onClose: () => void; onBack?: () => void; detailKey: string | null; children: React.ReactNode; returnFocus?: {current:HTMLButtonElement|null};
}) {
  const dialog = useRef<HTMLDialogElement>(null), scroll = useRef<HTMLDivElement>(null), listScroll = useRef(0);
  useBodyScrollLock(true);
  useEffect(() => {
    const previous = returnFocus?.current || document.activeElement as HTMLElement | null;
    const modal=dialog.current;
    modal?.showModal();
    return () => {
      modal?.close();
      queueMicrotask(()=>{if(previous?.isConnected&&!document.activeElement?.closest('dialog[open],[role="dialog"][aria-modal="true"]'))previous.focus({preventScroll:true});});
    };
  }, []);
  useEffect(() => {
    if (!scroll.current) return;
    scroll.current.scrollTop = detailKey ? 0 : listScroll.current;
    const target = dialog.current?.querySelector<HTMLElement>(detailKey ? '#impact-radar-detail-title' : '#impact-radar-dashboard-title');
    target?.focus({ preventScroll: true });
  }, [detailKey]);
  return createPortal(<dialog ref={dialog} className="impact-radar impact-radar-window" aria-labelledby={detailKey ? 'impact-radar-detail-title' : 'impact-radar-dashboard-title'} onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className="impact-radar-window-bar"><div>{onBack && <button type="button" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" />Back to Radar</button>}</div>
      <button type="button" className="impact-radar-close" aria-label="Close Impact Radar" onClick={onClose}><X size={20} aria-hidden="true" /></button></div>
    <div className="impact-radar-window-body" ref={scroll} onScroll={e=>{if(!detailKey)listScroll.current=e.currentTarget.scrollTop;}}>{children}</div>
  </dialog>, document.body);
}
