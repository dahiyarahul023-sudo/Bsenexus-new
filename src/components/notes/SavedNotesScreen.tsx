import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Search, Plus, Pencil, Trash2, ChevronRight, RefreshCw,
  TrendingUp, Newspaper, CalendarDays, FileText, Loader2,
} from 'lucide-react';
import { fetchNotes, deleteNoteApi } from '../../api/notesApi';
import { useNoteEditor } from '../../context/NoteEditorContext';
import { useIntelModal } from '../../context/IntelModalContext';
import { useAuth } from '../../context/AuthContext';
import { NotesSkeleton } from '../ui/PageSkeleton';
import { NotesIllustration } from './NoteCharacter';
import './notes.css';
import { noteIconAt } from './noteIcons';
import type { UserNote, NoteLinkType } from '../../types';
import { navigateToFiling } from '../../utils/shareUrls';
import { cn } from '../../lib/utils';

const LINK_META: Record<NoteLinkType, { icon: any; tint: string; label: string }> = {
  stock: { icon: TrendingUp, tint: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'Stock' },
  news: { icon: Newspaper, tint: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', label: 'News' },
  result: { icon: CalendarDays, tint: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', label: 'Result' },
  filing: { icon: FileText, tint: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Filing' },
};

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function NoteRow({
  note, onJump, onEdit, onDelete, deleting, confirmDelete, setConfirmDelete,
}: {
  note: UserNote;
  onJump: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();
  const icon = noteIconAt(note.icon);
  const linkMeta = note.link ? LINK_META[note.link.type] : null;
  const LinkIcon = linkMeta?.icon;

  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      className="note-row bg-white dark:bg-[#181626] border border-slate-200/90 dark:border-[#2D283E] rounded-2xl p-3.5 shadow-2xs"
    >
      <div className="flex items-start gap-3">
        <button
          type="button" onClick={onJump} aria-label={note.link ? `Open linked ${note.link.type}` : 'Open note'}
          className="w-11 h-11 shrink-0 cursor-pointer hover:scale-105 transition-transform overflow-hidden rounded-[14px] ring-1 ring-black/5 dark:ring-white/10"
        >
          <icon.Icon className="w-full h-full" />
        </button>
        <button type="button" onClick={onJump} className="flex-1 min-w-0 text-left cursor-pointer">
          <p className="text-[15px] leading-relaxed break-words text-slate-800 dark:text-slate-100 font-medium line-clamp-3">
            {note.text}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {note.link && LinkIcon && (
              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-bold', linkMeta!.tint)}>
                <LinkIcon size={11} />
                <span className="max-w-[120px] truncate">{note.link.label}</span>
              </span>
            )}
            {note.tags.slice(0, 3).map(t => (
              <span key={t} className="text-[12px] font-semibold text-orange-600 dark:text-orange-400">#{t}</span>
            ))}
            <span className="text-[12px] text-slate-400 ml-auto shrink-0">{timeAgo(note.updatedAt)}</span>
          </div>
        </button>
        <ChevronRight size={15} className="text-slate-300 dark:text-slate-600 shrink-0 mt-1" />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1 mt-2 pt-2 border-t border-slate-100 dark:border-[#252236]">
        {confirmDelete ? (
          <>
            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mr-1">Delete this note?</span>
            <button
              type="button" onClick={() => setConfirmDelete(false)} disabled={deleting}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
            >
              Keep
            </button>
            <button
              type="button" onClick={onDelete} disabled={deleting}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60 cursor-pointer inline-flex items-center gap-1.5"
            >
              {deleting && <Loader2 size={12} className="animate-spin" />}
              Delete
            </button>
          </>
        ) : (
          <>
            <button
              type="button" onClick={onEdit} aria-label="Edit note"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Pencil size={15} />
            </button>
            <button
              type="button" onClick={() => setConfirmDelete(true)} aria-label="Delete note"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

export function SavedNotesScreen({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { openNoteEditor } = useNoteEditor();
  const { openIntelModal } = useIntelModal();
  const { user, setIsAuthModalOpen } = useAuth();
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const isGuest = !user || (user as any).isAnonymous === true;

  const load = useCallback(async () => {
    if (isGuest) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchNotes();
      if (res.success && res.notes) {
        setNotes(res.notes);
      } else {
        setError(res.error || 'Could not load notes.');
      }
    } catch {
      setError('Could not load notes. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isGuest]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('notes-changed', h);
    return () => window.removeEventListener('notes-changed', h);
  }, [load]);

  const jumpTo = (note: UserNote) => {
    const link = note.link;
    if (!link) {
      // Personal note — open it for viewing/editing.
      openNoteEditor({ note });
      return;
    }
    if (link.type === 'stock') {
      openIntelModal({ symbol: link.symbol || link.label });
    } else if (link.type === 'news') {
      if (link.url) window.open(link.url, '_blank', 'noopener,noreferrer');
      else if (onNavigate) onNavigate('news');
    } else if (link.type === 'result') {
      if (onNavigate) onNavigate('results-calendar');
    } else if (link.type === 'filing') {
      // Filing: jump to its shareable filing page (/filing/:symbol/:newsId) when
      // we know the filing id; otherwise fall back to the PDF or company overview.
      const sym = (link.symbol || '').trim().toUpperCase();
      if (sym && link.newsId) {
        navigateToFiling(sym, link.newsId);
      } else if (link.url) window.open(link.url, '_blank', 'noopener,noreferrer');
      else if (link.symbol) openIntelModal({ symbol: link.symbol });
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await deleteNoteApi(id);
      if (res.success) {
        setNotes(ns => ns.filter(n => n.id !== id));
        setConfirmId(null);
      } else {
        setError(res.error || 'Could not delete the note.');
      }
    } catch {
      setError('Could not delete the note. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? notes.filter(n =>
        n.text.toLowerCase().includes(q) ||
        n.tags.some(t => t.toLowerCase().includes(q)) ||
        (n.link?.label.toLowerCase().includes(q) ?? false))
    : notes;

  if (isGuest) {
    return (
      <div className="notes-workspace"><div className="notes-empty text-slate-900 dark:text-white">
        <NotesIllustration onCreate={() => setIsAuthModalOpen(true)} />
        <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">Sign in to use Saved Notes</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
          Notes save permanently to your account and sync across devices.
        </p>
        <button
          type="button" onClick={() => setIsAuthModalOpen(true)}
          className="rich-action rich-action-primary mt-4 px-6 py-2.5 rounded-2xl text-sm font-bold min-h-[44px] cursor-pointer"
        >
          Sign in
        </button>
      </div></div>
    );
  }

  return (
    <div className="notes-workspace space-y-4 text-slate-900 dark:text-white">
      <div className="notes-toolbar">
        <div><p className="notes-eyebrow">Your research, remembered</p><h2 className="notes-title">Saved notes</h2></div>
        <button type="button" className="notes-primary rich-action rich-action-primary" onClick={() => openNoteEditor()}><Plus size={18} /> New note</button>
      </div>
      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          aria-label="Search notes, tags or stocks" type="search" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search notes, tags, stocks..."
          className="rich-input notes-search w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#181626] border border-slate-200/90 dark:border-[#2D283E] rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-orange-500/40 shadow-2xs"
        />
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={load} className="inline-flex items-center gap-1 font-bold hover:underline cursor-pointer shrink-0">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {loading && notes.length === 0 ? (
        <NotesSkeleton />
      ) : error && notes.length === 0 ? null : filtered.length === 0 ? (
        <div className="notes-empty">
          {q ? <Search size={38} className="text-slate-400" aria-hidden="true" /> : <NotesIllustration onCreate={() => openNoteEditor()} />}
          <h3>{q ? 'No matching notes' : 'Big ideas start with a little note.'}</h3>
          <p>{q ? 'Try another keyword, tag or stock name.' : 'Keep a thought, track a stock, or save the detail you’ll want to come back to.'}</p>
          <button type="button" className="notes-primary rich-action rich-action-primary" onClick={() => q ? setQuery('') : openNoteEditor()}>
            {!q && <Plus size={18} />}{q ? 'Clear search' : 'Create your first note'}
          </button>
          {!q && <span className="notes-empty-hint">Your notes stay together, across devices.</span>}
        </div>
      ) : (
        <AnimatePresence initial={false}>
          <div className="notes-grid">
            {filtered.map(n => (
              <NoteRow
                key={n.id}
                note={n}
                onJump={() => jumpTo(n)}
                onEdit={() => openNoteEditor({ note: n })}
                onDelete={() => handleDelete(n.id)}
                deleting={deletingId === n.id}
                confirmDelete={confirmId === n.id}
                setConfirmDelete={v => setConfirmId(v ? n.id : null)}
              />
            ))}
          </div>
        </AnimatePresence>
      )}


    </div>
  );
}

