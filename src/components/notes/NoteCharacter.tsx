import { useRef, type CSSProperties, type PointerEvent } from 'react';
import './notes.css';

/** Lightweight, layered clay illustration. No canvas or continuous render loop. */
export function NoteCharacter({ variant = 0, className = '' }: { variant?: number; className?: string }) {
  return <span className={`note-character note-character--${variant} ${className}`} aria-hidden="true">
    <span className="nc-shadow" /><span className="nc-ear nc-ear--left" /><span className="nc-ear nc-ear--right" />
    <span className="nc-body"><span className="nc-face"><i /><i /><b /></span><span className="nc-cheek nc-cheek--left" /><span className="nc-cheek nc-cheek--right" /></span>
    <span className="nc-foot nc-foot--left" /><span className="nc-foot nc-foot--right" />
  </span>;
}

export function NotesIllustration({ onCreate }: { onCreate: () => void }) {
  const scene = useRef<HTMLButtonElement>(null);
  const tilt = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    scene.current?.style.setProperty('--tilt-x', `${-(e.clientY - r.top - r.height / 2) / r.height * 12}deg`);
    scene.current?.style.setProperty('--tilt-y', `${(e.clientX - r.left - r.width / 2) / r.width * 16}deg`);
  };
  const reset = () => { scene.current?.style.setProperty('--tilt-x', '0deg'); scene.current?.style.setProperty('--tilt-y', '0deg'); };
  return <button ref={scene} type="button" className="notes-illustration" aria-label="Create your first note" onClick={onCreate} onPointerMove={tilt} onPointerLeave={reset} onPointerCancel={reset} style={{ '--tilt-x': '0deg', '--tilt-y': '0deg' } as CSSProperties}>
    <span className="notes-scene" aria-hidden="true">
      <span className="notes-orbit" />
      <span className="notes-paper notes-paper--back" />
      <span className="notes-paper"><span /><span /><span /><b>+</b></span>
      <NoteCharacter variant={0} />
      <span className="notes-spark">✦</span><span className="notes-dot" />
    </span>
  </button>;
}
