import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

function mountAuthProvider(options: {
  signInAnonymouslyImpl: () => Promise<any>;
  currentUser?: any;
}) {
  const actual = createRequire(import.meta.url);
  const React = actual('react');
  const states: any[] = [];
  const refs: any[] = [];
  const effects: Array<() => void> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effectsRan = false;

  const localStore = new Map<string, string>();
  const sessionStore = new Map<string, string>();
  const listeners = new Map<string, Set<(...args: any[]) => void>>();
  let authStateHandler: ((u: any) => Promise<void> | void) | null = null;
  const fetchCalls: string[] = [];
  const authObj: { currentUser: any } = { currentUser: options.currentUser ?? null };

  const react = {
    ...React,
    useState(value: any) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof value === 'function' ? value() : value;
      return [
        states[index],
        (next: any) => {
          states[index] = typeof next === 'function' ? next(states[index]) : next;
        },
      ];
    },
    useRef(value: any) {
      return (refs[refIndex++] ??= { current: value });
    },
    useEffect(fn: () => void) {
      if (!effectsRan) effects.push(fn);
    },
  };

  const exports: any = {};
  const code = ts.transpileModule(readFileSync('src/context/AuthContext.tsx', 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;

  const win = {
    location: { replace: () => {}, hostname: 'localhost' },
    self: {},
    top: {},
    addEventListener(type: string, cb: any) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    },
    removeEventListener(type: string, cb: any) {
      listeners.get(type)?.delete(cb);
    },
    dispatchEvent(evt: any) {
      const type = typeof evt === 'string' ? evt : evt?.type;
      for (const cb of listeners.get(type) ?? []) cb(evt);
    },
  };
  win.self = win;
  win.top = win;

  vm.runInNewContext(code, {
    exports,
    console,
    Date,
    Set,
    Math,
    CustomEvent: class CustomEvent {
      type: string;
      detail: any;
      constructor(type: string, init?: any) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    Event: class Event {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    },
    localStorage: {
      getItem: (k: string) => (localStore.has(k) ? localStore.get(k)! : null),
      setItem: (k: string, v: string) => localStore.set(k, String(v)),
      removeItem: (k: string) => localStore.delete(k),
    },
    sessionStorage: {
      getItem: (k: string) => (sessionStore.has(k) ? sessionStore.get(k)! : null),
      setItem: (k: string, v: string) => sessionStore.set(k, String(v)),
      removeItem: (k: string) => sessionStore.delete(k),
      clear: () => sessionStore.clear(),
    },
    document: {
      visibilityState: 'visible',
      addEventListener() {},
      removeEventListener() {},
      documentElement: { dataset: {}, classList: { add() {}, remove() {} } },
    },
    window: win,
    require(name: string) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return actual(name);
      if (name === 'firebase/auth') {
        return {
          signInAnonymously: options.signInAnonymouslyImpl,
          updateProfile: async () => {},
          signOut: async () => {},
          onAuthStateChanged: (_a: any, cb: any) => {
            authStateHandler = cb;
            return () => {};
          },
        };
      }
      if (name.endsWith('/firebase')) return { auth: authObj, googleProvider: {} };
      if (name.endsWith('/api')) {
        return {
          customFetch: async (url: string) => {
            fetchCalls.push(url);
            return new Response(JSON.stringify({ success: false }), { status: 401 });
          },
        };
      }
      if (name.endsWith('/useExpiryClock')) return { useExpiryClock: () => Date.now() };
      if (name.endsWith('/avatarSave')) return { createAvatarSaveController: () => ({}) };
      if (name.endsWith('/preferenceSaveQueue')) return { createPreferenceSaveQueue: () => ({}) };
      if (name.endsWith('/recaptcha')) return { executeRecaptcha: async () => ({ bypassed: true, token: '' }) };
      if (name.endsWith('/cashfree')) return { recoverPendingPayments: async () => ({ recoveredCount: 0, unavailable: false }) };
      if (name.endsWith('/retry')) return { reportSyncStatus: () => {}, withRetry: (fn: any) => fn() };
      if (name.endsWith('/usePaymentDialog')) return { usePaymentDialog: () => ({ current: null }) };
      return {};
    },
  });

  const render = () => {
    stateIndex = 0;
    refIndex = 0;
    const tree = exports.AuthProvider({ children: null });
    if (!effectsRan) {
      effectsRan = true;
      for (const fn of effects) fn();
    }
    return tree.props.value;
  };

  return {
    render,
    authObj,
    localStore,
    sessionStore,
    fetchCalls,
    fireAuthStateChanged: (u: any) => authStateHandler?.(u),
    dispatchWindowEvent: (type: string) => win.dispatchEvent({ type }),
  };
}

test('fallback local guest login sets user/profile and closes modal when Firebase anonymous auth is restricted', async () => {
  const ctx = mountAuthProvider({
    signInAnonymouslyImpl: async () => {
      const err: any = new Error('Restricted');
      err.code = 'auth/admin-restricted-operation';
      throw err;
    },
  });

  let value = ctx.render();
  value.setIsAuthModalOpen(true);
  value = ctx.render();
  assert.equal(value.isAuthModalOpen, true);
  assert.equal(value.user, null);

  const res = await value.quickDemoLogin('Guest');
  assert.equal(res.success, true);

  value = ctx.render();
  assert.equal(value.isAuthModalOpen, false);
  assert.ok(value.user, 'fallback guest user must be set immediately');
  assert.equal(value.user.isAnonymous, true);
  assert.ok(String(value.user.uid).startsWith('trader_'));
  assert.equal(value.profile?.tier, 'free');
  assert.equal(value.profile?.proExpiresAt, 0);
  assert.equal(value.profile?.maxWatchlistStocks, 5);
  assert.equal(value.isAdmin, false);
  assert.equal(value.isPro, false);
  assert.equal(ctx.localStore.has('bse_nexus_auth_session'), false, 'guest session must never persist in localStorage');
  assert.deepEqual(ctx.fetchCalls, [], 'guest sync must not call /auth/status or /api/users/profile');

  // Late initial onAuthStateChanged(null) or 401 auth-expired must not kick an active local guest back out
  await ctx.fireAuthStateChanged(null);
  ctx.dispatchWindowEvent('auth-expired');
  value = ctx.render();
  assert.ok(value.user?.isAnonymous, 'active local guest session must survive null auth listener and auth-expired');
  assert.equal(value.isAuthModalOpen, false);
});

test('Firebase anonymous guest login succeeds without racing onAuthStateChanged', async () => {
  const anonUser = {
    uid: 'anon_fb_123',
    displayName: 'Guest',
    email: null,
    isAnonymous: true,
    photoURL: null,
    getIdToken: async () => '',
  };
  let ctx!: ReturnType<typeof mountAuthProvider>;
  ctx = mountAuthProvider({
    signInAnonymouslyImpl: async () => {
      ctx.authObj.currentUser = anonUser;
      // Simulate Firebase firing onAuthStateChanged concurrently (bumps sessionEpoch)
      void ctx.fireAuthStateChanged(anonUser);
      return { user: anonUser };
    },
  });

  let value = ctx.render();
  value.setIsAuthModalOpen(true);
  value = ctx.render();

  const res = await value.quickDemoLogin('Guest');
  assert.equal(res.success, true);

  value = ctx.render();
  assert.equal(value.isAuthModalOpen, false);
  assert.equal(value.user?.uid, 'anon_fb_123');
  assert.equal(value.profile?.tier, 'free');
  assert.equal(value.profile?.proExpiresAt, 0);
  assert.deepEqual(ctx.fetchCalls, []);
});
