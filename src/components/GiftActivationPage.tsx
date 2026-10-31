import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { customFetch } from '../api';
import type { GiftInvite } from '../shared/giftAccess';
import './gift-access.css';

export function GiftActivationPage() {
  const { user, authLoading, setIsAuthModalOpen, refreshProfile, logout } = useAuth();
  const [token, setToken] = useState(() => {
    const value = (window as any).__BN_GIFT_TOKEN__ || '';
    return /^bnx_gift_[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
  });
  const [firebaseUser, setFirebaseUser] = useState<User | null>(() => auth.currentUser);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (typeof auth.authStateReady === 'function') {
      auth.authStateReady()
        .then(() => {
          if (active) {
            setFirebaseUser(auth.currentUser);
            setAuthReady(true);
          }
        })
        .catch(() => {
          if (active) setAuthReady(true);
        });
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      if (active) {
        setFirebaseUser(u);
        setAuthReady(true);
      }
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    const capture = () => {
      if (!window.location.hash) return;
      const value = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
      const next = /^bnx_gift_[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
      (window as any).__BN_GIFT_TOKEN__ = next;
      window.history.replaceState(null, '', window.location.pathname);
      setToken(next);
    };
    capture(); window.addEventListener('hashchange', capture);
    return () => window.removeEventListener('hashchange', capture);
  }, []);

  // Guarantee an active user only when it possesses the genuine Firebase User methods
  const resolvedUser = (firebaseUser && typeof firebaseUser.getIdToken === 'function')
    ? firebaseUser
    : (user && typeof user.getIdToken === 'function')
      ? user
      : (auth.currentUser && typeof auth.currentUser.getIdToken === 'function')
        ? auth.currentUser
        : null;

  const account = resolvedUser?.uid || (user && !user.isAnonymous ? user.uid : '');

  return (
    <GiftActivationAccount
      key={(account || 'guest') + ':' + token}
      token={token}
      user={resolvedUser}
      authReady={authReady}
      loadingAuth={authLoading || !authReady}
      signIn={() => setIsAuthModalOpen(true)}
      refresh={refreshProfile}
      logout={logout}
    />
  );
}

function GiftActivationAccount({
  token,
  user,
  authReady,
  loadingAuth,
  signIn,
  refresh,
  logout
}: {
  token: string;
  user: any;
  authReady: boolean;
  loadingAuth: boolean;
  signIn: () => void;
  refresh: () => Promise<any>;
  logout: () => Promise<any>;
}) {
  const [invite, setInvite] = useState<GiftInvite | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(false),
    [paid, setPaid] = useState(0);
  const alive = useRef(true),
    request = useRef<AbortController | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, []);

  async function run(action: 'preview' | 'claim') {
    if (!token || busy) return;
    setBusy(true);
    setError('');
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;

    try {
      // 1. Await Firebase auth readiness if not ready yet
      if (!authReady && typeof auth.authStateReady === 'function') {
        await auth.authStateReady().catch(() => {});
      }

      // 2. Resolve genuine Firebase user instance
      let activeUser = (user && typeof user.getIdToken === 'function')
        ? user
        : (auth.currentUser && typeof auth.currentUser.getIdToken === 'function')
          ? auth.currentUser
          : null;

      if (!activeUser || typeof activeUser.getIdToken !== 'function') {
        // Fallback: wait briefly for onAuthStateChanged in case of rapid click during cold boot
        activeUser = await new Promise<any>((resolve) => {
          const timer = setTimeout(() => resolve(null), 2500);
          const unsub = onAuthStateChanged(auth, (u) => {
            if (u && typeof u.getIdToken === 'function') {
              clearTimeout(timer);
              unsub();
              resolve(u);
            }
          });
        });
      }

      if (!activeUser || typeof activeUser.getIdToken !== 'function') {
        throw new Error('Please sign in with the invited email to check this invitation.');
      }

      const firebaseIdToken = await activeUser.getIdToken(true);
      if (!alive.current) return;

      const res = await customFetch('/api/gifts/' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Gift-Action': '1' },
        body: JSON.stringify({ token, firebaseIdToken }),
        signal: controller.signal
      });
      const data = await res.json();
      if (!alive.current) return;
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not confirm this invitation.');
      }
      setInvite(data.invite);
      setPaid(data.paidExpiresAt || 0);
      if (data.invite.status === 'expired') {
        setError('This gift access period has ended.');
        return;
      }
      if (action === 'claim' || data.alreadyActivated) {
        setSuccess(true);
        delete (window as any).__BN_GIFT_TOKEN__;
        // A profile-refresh outage must not relabel an already committed grant as failed.
        await refresh().catch(() => {});
      }
    } catch (e) {
      if (alive.current && !controller.signal.aborted) {
        setError(
          e instanceof Error
            ? e.message
            : 'Could not confirm the invitation. Retry to check its status.'
        );
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <main className="gift-page">
      <section className="gift-access" aria-labelledby="gift-activation-title">
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: '8px' }}>
          <img src="/icon-512.png" alt="BSE Nexus" width="36" height="36" style={{ borderRadius: '8px', display: 'block' }} />
          <span style={{ fontWeight: 700, fontSize: '18px' }}>BSE Nexus</span>
        </a>
        <h1 id="gift-activation-title">Your Pro invitation</h1>
        {!token ? (
          <p>Open the activation link shared with you. After a page reload, reopen that invitation link.</p>
        ) : loadingAuth ? (
          <p role="status">Verifying your sign-in…</p>
        ) : !user ? (
          <>
            <p>Sign in with the email this invitation was sent to. Opening the link does not activate access.</p>
            <button type="button" onClick={signIn}>Sign in to continue</button>
          </>
        ) : (
          <>
            <p>Signed in as <strong>{user.email}</strong></p>
            {error && <p role="alert" className="gift-error">{error}</p>}
            {success && invite ? (
              <div role="status" className="gift-status">
                <h2>Gift Pro is active</h2>
                <p>{invite.validityDays} days · Valid until {new Date(invite.expiresAt!).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} IST.</p>
                <p>No payment or auto-charge.</p>
                <a href="/settings">View your subscription</a>
              </div>
            ) : (
              <>
                {invite && (
                  <div className="gift-review">
                    <h2>{invite.validityDays} days of Pro</h2>
                    <p>Your access starts when you confirm activation.</p>
                    <p>Claim by {new Date(invite.claimUntil).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} IST.</p>
                    {paid > Date.now() && (
                      <p>You already have paid Pro until {new Date(paid).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} IST. This gift runs alongside it; it does not extend that plan.</p>
                    )}
                    <p>No payment required. No auto-charge.</p>
                  </div>
                )}
                <button type="button" disabled={busy} onClick={() => void run(invite && !error ? 'claim' : 'preview')}>
                  {busy ? 'Checking…' : invite && !error ? 'Confirm activation' : 'Check invitation'}
                </button>
                <button type="button" className="gift-secondary" disabled={busy} onClick={() => void logout()}>
                  Switch account
                </button>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
