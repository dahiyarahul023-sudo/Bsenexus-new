import React, { useEffect, useRef, useState } from 'react';
import { customFetch } from '../api';
import { ActionButton } from './ui/ActionButton';

/** The bot proves the destination. Typed chat IDs never establish ownership. */
export function TelegramLinkControl({ uid, onVerified }: { uid: string; onVerified: (chatId: string) => Promise<void> }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const epoch = useRef(0);
  useEffect(() => { epoch.current++; setUrl(''); setMessage(''); setBusy(false); return () => { epoch.current++; }; }, [uid]);
  async function run(start: boolean) {
    const request = ++epoch.current;
    setBusy(true); setMessage('');
    try {
      const response = await customFetch('/api/users/telegram/link', { method: start ? 'POST' : 'GET' });
      const data = await response.json();
      if (request !== epoch.current) return;
      if (!response.ok) throw new Error(data.error || 'Could not verify Telegram. Please retry.');
      if (start) { setUrl(data.url); setMessage('Open the verification link and press Start. The link expires in 10 minutes.'); }
      else if (data.verified) { await onVerified(data.chatId); if (request === epoch.current) { setUrl(''); setMessage('Telegram connection verified.'); } }
      else setMessage('Not verified yet. Open the link, press Start, then check again.');
    } catch (error: any) { if (request === epoch.current) setMessage(error.message); }
    finally { if (request === epoch.current) setBusy(false); }
  }
  return <div className="space-y-2 p-3 rounded-xl border border-blue-200 dark:border-blue-800 text-xs">
    <p>Verify your personal Telegram account before saving or testing alerts. Existing connections also need verification.</p>
    <div className="flex flex-wrap gap-2">
      <ActionButton type="button" size="sm" variant="secondary" disabled={busy} onClick={() => run(true)}>Create verification link</ActionButton>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold underline px-2 py-2">Open Telegram and press Start</a>}
      <ActionButton type="button" size="sm" variant="secondary" disabled={busy} onClick={() => run(false)}>Check verification</ActionButton>
    </div>
    {message && <p role="status">{message}</p>}
  </div>;
}
