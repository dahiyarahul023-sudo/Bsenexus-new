import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { ModernAuthCard } from './ui/ModernAuthCard';

export function AuthModal({ onSuccess }: { onSuccess?: () => void }) {
  const { isAuthModalOpen, setIsAuthModalOpen } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useBodyScrollLock(isAuthModalOpen);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isAuthModalOpen || !dialog) return;

    const previous = document.activeElement;
    const viewport = window.visualViewport;
    const updateViewport = () => {
      dialog.style.setProperty('--auth-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      dialog.style.setProperty('--auth-viewport-top', `${viewport?.offsetTop ?? 0}px`);
    };
    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);
    dialog.showModal();

    return () => {
      dialog.close();
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
      // The cold-load placeholder may have had focus before the card opened.
      // Let its existing restoration run if the original element is disconnected.
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const close = () => setIsAuthModalOpen(false);

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-x-0 bottom-auto top-[calc(var(--auth-viewport-top,0px)+var(--auth-viewport-height,100dvh)/2)] mx-auto my-0 w-[calc(100%-1rem)] max-w-[500px] max-h-[calc(var(--auth-viewport-height,100dvh)-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] -translate-y-1/2 rounded-[24px] overflow-y-auto overscroll-contain bg-white p-0 shadow-2xl backdrop:bg-slate-950/75 sm:w-[calc(100%-2rem)] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), [tabindex="0"]',
        )).filter((control) => control.tabIndex >= 0 && control.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable.at(-1);
        const active = document.activeElement;
        if ((event.shiftKey && active === first) || (!event.shiftKey && active === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }}
    >
      <ModernAuthCard mode="modal" initialTab="signin" onClose={close} onSuccess={onSuccess} />
    </dialog>
  );
}
