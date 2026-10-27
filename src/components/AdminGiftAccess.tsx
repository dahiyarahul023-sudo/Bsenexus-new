import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { customFetch } from '../api';
import type { GiftInvite } from '../shared/giftAccess';
import './gift-access.css';

export function AdminGiftAccess() {
  const { user } = useAuth();
  return <AdminGiftAccessAccount key={user?.uid || 'guest'} />;
}
function AdminGiftAccessAccount() {
  const { setIsAdminPinModalOpen } = useAuth();
  const [items, setItems] = useState<GiftInvite[]>([]), [offset, setOffset] = useState(0), [more, setMore] = useState(false);
  const [email, setEmail] = useState(''), [days, setDays] = useState(30), [claimDays, setClaimDays] = useState(7), [note, setNote] = useState('');
  const [review, setReview] = useState(false), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [revoke, setRevoke] = useState<string | null>(null), [mail, setMail] = useState(false);
  const [ready, setReady] = useState(false);
  const createId = useRef(crypto.randomUUID()), alive = useRef(true), sequence = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; sequence.current++; }; }, []);
  const edit = () => { createId.current = crypto.randomUUID(); setReview(false); setMessage(''); };
  async function load(page = offset) {
    const seq = ++sequence.current; setLoading(true); setError('');
    try {
      const res = await customFetch('/api/gifts/admin?offset=' + page, { cache: 'no-store' });
      const data = await res.json(); if (!alive.current || seq !== sequence.current) return;
      if (!res.ok || !data.success) throw new Error(giftAdminError(res, data, 'Could not load invitations.'));
      setItems(data.items); setMore(data.hasMore); setMail(data.mailConfigured); setReady(true); setOffset(page);
    } catch (e) { if (alive.current && seq === sequence.current) { setReady(false); setError(e instanceof Error ? e.message : 'Could not load invitations.'); } }
    finally { if (alive.current && seq === sequence.current) setLoading(false); }
  }
  useEffect(() => { void load(0); }, []);
  async function mutate(path: string, body: object) {
    const res = await customFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Gift-Action': '1' }, body: JSON.stringify(body) });
    const data = await res.json(); if (!res.ok || !data.success) throw new Error(giftAdminError(res, data, 'Refresh invitations before retrying.')); return data;
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy || loading || !ready || !mail) return; if (!review) { setReview(true); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const data = await mutate('/api/gifts/admin', { requestId: createId.current, email: email.trim(), validityDays: days, claimDays, note });
      if (!alive.current) return;
      setMessage(data.invite.delivery === 'accepted' ? 'Email accepted by the mail provider. Activation is still pending.' : 'Invitation saved. Email delivery is ' + data.invite.delivery + '. Check the list before resending.');
      setEmail(''); setNote(''); setReview(false); createId.current = crypto.randomUUID(); await load(0);
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Refresh invitations before retrying.'); }
    finally { if (alive.current) setBusy(false); }
  }
  async function action(invite: GiftInvite, kind: 'resend' | 'revoke') {
    if (busy || loading || !ready) return; setBusy(true); setError(''); setMessage('');
    try {
      const data = await mutate(`/api/gifts/admin/${invite.id}/${kind}`, { requestId: crypto.randomUUID() });
      if (!alive.current) return;
      setRevoke(null); setMessage(kind === 'revoke' ? 'Gift revoked. Any separate paid access remains active.' : `New link created; email status: ${data.invite.delivery}. The previous link is invalid.`);
      await load(offset);
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Refresh invitations before retrying.'); }
    finally { if (alive.current) setBusy(false); }
  }
  return <section className="gift-access" aria-labelledby="gift-admin-title">
    <header><h3 id="gift-admin-title">Gift Pro Access</h3><p>Invite one verified email. Access starts on confirmation and runs alongside existing paid access.</p></header>
    <button type="button" className="gift-secondary" onClick={() => setIsAdminPinModalOpen(true)}>Verify admin PIN</button>
    {error && <div role="alert" className="gift-error">{error} <button type="button" disabled={busy} onClick={() => void load()}>Refresh invitations</button></div>}
    {message && <p role="status" className="gift-status">{message}</p>}
    <form onSubmit={submit}>
      <p>Up to 50 new invitations per 24 hours. Resends keep the original claim deadline.</p>
      <fieldset disabled={busy}><legend>New invitation</legend>
        <label>Email<input type="email" required maxLength={254} value={email} onChange={e => { edit(); setEmail(e.target.value); }} autoCapitalize="none" autoCorrect="off" /></label>
        <div className="gift-columns"><label>Pro access (days)<input type="number" min={1} max={3650} required value={days} onChange={e => { edit(); setDays(Number(e.target.value)); }} /></label>
        <label>Claim within (days)<input type="number" min={1} max={30} required value={claimDays} onChange={e => { edit(); setClaimDays(Number(e.target.value)); }} /></label></div>
        <label>Internal note (optional)<textarea maxLength={500} value={note} onChange={e => { edit(); setNote(e.target.value); }} /></label>
        {review && <div className="gift-review"><strong>{email.trim()}</strong><p>{days} days of Pro from activation. Claim within {claimDays} days of sending.</p><p>No payment, referral reward or auto-charge. This does not add days to an existing paid plan.</p></div>}
        <button type="submit" disabled={!ready || !mail || loading || busy}>{busy ? 'Saving…' : review ? 'Send activation email' : 'Review invitation'}</button>
      </fieldset>
    </form>
    <div className="gift-list-heading"><h4>Invitation history</h4><button type="button" className="gift-secondary" disabled={busy || loading} onClick={() => void load()}>Refresh</button></div>
    {loading && !items.length ? <div role="status" aria-label="Loading invitations" className="gift-skeleton">Loading invitations…</div> : !loading && !error && !items.length ? <p>No invitations yet.</p> : null}
    <ul className="gift-list" aria-busy={loading}>{items.map(i => <li key={i.id}>
      <strong>{i.email}</strong><p>{i.validityDays} days · {i.status} · Email: {i.delivery}</p>
      <p>{i.activatedAt ? `Valid until ${formatGiftDate(i.expiresAt!)}` : `Claim by ${formatGiftDate(i.claimUntil)}`}</p>
      {i.note && <p className="gift-note">{i.note}</p>}
      <div className="gift-actions">{i.status === 'pending' && <button type="button" className="gift-secondary" disabled={busy || loading || !ready} onClick={() => void action(i, 'resend')}>Resend new link</button>}
      {(i.status === 'pending' || i.status === 'activated') && (revoke === i.id ? <><span>Revoke this gift?</span><button type="button" disabled={busy || loading || !ready} onClick={() => void action(i, 'revoke')}>Confirm revoke</button><button type="button" className="gift-secondary" disabled={busy} onClick={() => setRevoke(null)}>Cancel</button></> : <button type="button" className="gift-secondary" disabled={busy || loading || !ready} onClick={() => setRevoke(i.id)}>Revoke</button>)}</div>
    </li>)}</ul>
    <div className="gift-actions"><button type="button" className="gift-secondary" disabled={offset === 0 || busy || loading} onClick={() => void load(Math.max(0, offset - 20))}>Previous</button><button type="button" className="gift-secondary" disabled={!more || busy || loading} onClick={() => void load(offset + 20)}>Next</button></div>
  </section>;
}
export function formatGiftDate(value: number) { return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) + ' IST'; }

function giftAdminError(response: Response, data: { error?: string; code?: string }, fallback: string) {
  if (data.code === 'API_NON_JSON_RESPONSE') {
    return 'The connected preview returned a page instead of Gift Access data. Wait for the server to be ready, then refresh invitations. If it persists, check that this preview and its API server use the same code. No email or access change has been confirmed.';
  }
  if (response.status === 404) {
    return 'Gift Access is missing from the connected server. Sync the latest code, restart the app preview, then refresh invitations. If this preview uses a separate API server, update that server too.';
  }
  return data.error || fallback;
}
