import { auth, initAppCheck } from './firebase';

// Expiry inspection only prevents sending stale credentials; the server still
// verifies every signature/identity. A JWT-shaped string alone is not usable.
function tokenIsCurrent(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some(part => !part)) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp) && payload.exp * 1000 > Date.now();
  } catch { return false; }
}

export async function customFetch(url: string, options: RequestInit = {}) {
  try {
    const apiBase = (((import.meta as any).env?.VITE_API_BASE_URL as string) || '').replace(/\/$/, '');
    const resolvedUrl = (apiBase && url.startsWith('/')) ? `${apiBase}${url}` : url;
    const headers = new Headers(options.headers || {});
    const forgetToken = () => { try { localStorage.removeItem('bse_nexus_fb_id_token'); } catch {} };
    const rememberToken = (token: string) => { try { localStorage.setItem('bse_nexus_fb_id_token', token); } catch {} };
    const currentUser = auth?.currentUser;
    try {
      const supplied = headers.get('Authorization');
      if (supplied?.startsWith('Bearer ') && !tokenIsCurrent(supplied.slice(7))) {
        headers.delete('Authorization'); forgetToken();
      }
      if (!headers.has('Authorization')) {
        let token = '';
        if (currentUser && !currentUser.isAnonymous) {
          token = await currentUser.getIdToken(false);
          if (!tokenIsCurrent(token)) token = await currentUser.getIdToken(true);
        } else {
          token = localStorage.getItem('bse_nexus_fb_id_token') || '';
        }
        if (tokenIsCurrent(token)) { headers.set('Authorization', `Bearer ${token}`); rememberToken(token); }
        else forgetToken(); // Send cookie only, never the expired fallback.
      }
    } catch (error: any) {
      if (error?.name === 'AbortError' || options.signal?.aborted) throw error;
      headers.delete('Authorization'); forgetToken();
    }

    if (url.startsWith('/auth/') && (import.meta as any).env?.VITE_APPCHECK_ENFORCE === 'true') {
      const appCheck = initAppCheck();
      if (!appCheck) throw new Error('Security verification is unavailable. Please retry.');
      const { getToken } = await import('firebase/app-check');
      const token = await getToken(appCheck);
      headers.set('X-Firebase-AppCheck', token.token);
    }
    const request = () => {
      if (currentUser && auth.currentUser?.uid !== currentUser.uid) throw new DOMException('Account changed', 'AbortError');
      return fetch(resolvedUrl, { credentials: 'include', ...options, headers });
    };
    let res = await request();
    // Credential/PIN mistakes are not expired sessions and must not be replayed.
    const pinOrLogin = url === '/auth/verify-pin' || url === '/auth/login';
    if (res.status === 401 && !pinOrLogin && url !== '/auth/session' && url !== '/auth/status') {
      if (currentUser && !currentUser.isAnonymous && auth.currentUser?.uid === currentUser.uid) {
        try {
          const token = await currentUser.getIdToken(true);
          if (tokenIsCurrent(token)) { headers.set('Authorization', `Bearer ${token}`); rememberToken(token); }
          else { headers.delete('Authorization'); forgetToken(); }
          res = await request();
        } catch (error: any) {
          if (error?.name === 'AbortError' || options.signal?.aborted) throw error;
        }
      }
      if (res.status === 401 && headers.has('Authorization')) {
        headers.delete('Authorization'); forgetToken();
        res = await request();
      }
    }
    if ((res.status === 401 && !pinOrLogin && url !== '/auth/status') || res.status === 403) {
      const denial = await res.clone().json().catch(() => ({}));
      if (denial.authRequired || denial.code === 'ADMIN_AUTH_REQUIRED' || (res.status === 401 && !pinOrLogin)) {
        window.dispatchEvent(new Event('auth-expired'));
      }
      // adminElevationRequired is intentionally preserved for the action owner
      // to obtain PIN elevation; transport never replays a 403 mutation.
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html') && !contentType.includes('application/json')) {
      return new Response(JSON.stringify({ success: false, code: 'API_NON_JSON_RESPONSE', upstreamStatus: res.status,
        error: 'The connected server returned a page instead of API data. Wait for the server to be ready, then refresh.', items: [] }), {
        status: res.ok ? 502 : res.status, headers: { 'Content-Type': 'application/json' }
      });
    }
    if (res.ok) window.dispatchEvent(new CustomEvent('network-status', { detail: { isOnline: true } }));
    return res;
  } catch (error: any) {
    if (error?.name === 'AbortError' || options.signal?.aborted) throw error;
    window.dispatchEvent(new CustomEvent('network-status', { detail: { isOnline: false, error: error.message || 'Connection lost' } }));
    return new Response(JSON.stringify({ success: false, error: error.message || 'Failed to fetch', items: [] }), {
      status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'application/json' }
    });
  }
}
