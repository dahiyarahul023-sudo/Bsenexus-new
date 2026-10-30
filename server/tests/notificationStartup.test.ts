import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createUnreadNotificationCounter, notificationCountOwner } from '../../src/utils/unreadNotificationCount';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('cached/guest/loading sessions never fetch a private badge; verified login does', async () => {
  let calls = 0;
  const snapshots: any[] = [];
  const counter = createUnreadNotificationCounter(async () => { calls++; return { unreadCount: 3 }; }, value => snapshots.push(value));
  for (const user of [null, { uid: 'cached' }, { uid: 'guest', isAnonymous: true, getIdToken() {} }]) {
    counter.setOwner(notificationCountOwner(user, false));
    await counter.refresh();
  }
  const user = { uid: 'account-a', getIdToken() {} };
  counter.setOwner(notificationCountOwner(user, true));
  await counter.refresh();
  assert.equal(calls, 0);
  counter.setOwner(notificationCountOwner(user, false));
  assert.deepEqual(snapshots.at(-1), { owner: 'account-a', count: null });
  await counter.refresh();
  assert.equal(calls, 1);
  assert.deepEqual(snapshots.at(-1), { owner: 'account-a', count: 3 });
});

test('a late 999 response cannot replace the current account count after switching or logout', async () => {
  const old = deferred<unknown>();
  let calls = 0;
  let oldSignal!: AbortSignal;
  const snapshots: any[] = [];
  const counter = createUnreadNotificationCounter(async signal => {
    if (++calls === 1) { oldSignal = signal; return old.promise; }
    return { unreadCount: 2 };
  }, value => snapshots.push(value));
  counter.setOwner('a');
  const pending = counter.refresh();
  counter.setOwner('b');
  assert.equal(oldSignal.aborted, true);
  await counter.refresh();
  old.resolve({ unreadCount: 999 });
  await pending;
  assert.deepEqual(snapshots.at(-1), { owner: 'b', count: 2 });
  counter.setOwner(null);
  await counter.refresh();
  assert.deepEqual(snapshots.at(-1), { owner: null, count: null });
  assert.equal(calls, 2);
});

test('newer post-read refresh wins; failure and malformed data keep the confirmed same-owner value', async () => {
  const old = deferred<unknown>();
  let result: unknown = { unreadCount: 1 };
  let calls = 0;
  const snapshots: any[] = [];
  const counter = createUnreadNotificationCounter(async () => {
    if (++calls === 1) return old.promise;
    if (result instanceof Error) throw result;
    return result;
  }, value => snapshots.push(value));
  counter.setOwner('a');
  const pending = counter.refresh();
  await counter.refresh();
  old.resolve({ unreadCount: 500 });
  await pending;
  for (result of [new Error('offline'), {}, { unreadCount: -1 }, { unreadCount: '999' }, { unreadCount: 1.5 }, { unreadCount: Infinity }]) {
    await counter.refresh();
    assert.deepEqual(snapshots.at(-1), { owner: 'a', count: 1 });
  }
  result = { unreadCount: 0 };
  await counter.refresh();
  assert.deepEqual(snapshots.at(-1), { owner: 'a', count: 0 });
});

test('StrictMode cleanup/replay ignores the first effect and permits the second read', async () => {
  const first = deferred<unknown>();
  let calls = 0;
  const snapshots: any[] = [];
  const counter = createUnreadNotificationCounter(async () => ++calls === 1 ? first.promise : { unreadCount: 4 }, value => snapshots.push(value));
  counter.setOwner('a'); const pending = counter.refresh();
  counter.setOwner(null); counter.setOwner('a');
  await counter.refresh(); first.resolve({ unreadCount: 777 }); await pending;
  assert.deepEqual(snapshots.at(-1), { owner: 'a', count: 4 });
});

/** Run the real SDK adapter with only browser/CDN boundaries replaced. */
function pushBrowser(permission: NotificationPermission = 'default', ios = false, saved = new Map<string,string>()) {
  const source = fs.readFileSync('src/utils/oneSignal.ts', 'utf8').replace(/\(import\.meta as any\)/g, '({ env: {} })');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const timers = new Map<number, () => void>();
  let timerId = 0;
  let nativeRequests = 0;
  let optIns = 0;
  let optOuts = 0;
  let initCalls = 0;
  let options: any;
  const notifications = new Map<string, () => void>();
  const subscriptions = new Map<string, () => void>();
  const scripts: any[] = [];
  const document = {
    querySelector: () => scripts.find(script => !script.removed) || null,
    createElement: () => { const script: any = { dataset: {}, remove() { script.removed = true; } }; return script; },
    head: { appendChild: (script: any) => scripts.push(script) },
  };
  const window: any = { OneSignalDeferred: [], navigator: { standalone: false }, requestIdleCallback() {}, matchMedia: () => ({ matches: false }) };
  const Notification = { get permission() { return permission; }, requestPermission() { nativeRequests++; permission = 'granted'; return Promise.resolve(permission); } };
  const sdk = {
    init: async (value: any) => { initCalls++; options = value; },
    Notifications: { isPushSupported: () => true, addEventListener: (event: string, callback: () => void) => notifications.set(event, callback) },
    User: { PushSubscription: { optedIn: false, optIn: async () => { optIns++; sdk.User.PushSubscription.optedIn = true; }, optOut: async () => { optOuts++; sdk.User.PushSubscription.optedIn = false; }, addEventListener: (event: string, callback: () => void) => subscriptions.set(event, callback) } },
  };
  const exports: any = {};
  new Function('exports', 'window', 'document', 'Notification', 'navigator', 'setTimeout', 'clearTimeout', 'localStorage', compiled)(
    exports, window, document, Notification,
    { userAgent: ios ? 'iPhone' : 'Chrome', platform: ios ? 'iPhone' : 'Linux', maxTouchPoints: 0 },
    (callback: () => void) => { timers.set(++timerId, callback); return timerId; },
    (id: number) => timers.delete(id),
    {getItem:(key:string)=>saved.get(key) ?? null,setItem:(key:string,value:string)=>saved.set(key,value)},
  );
  return {
    client: exports, window, sdk, scripts, timers, saved,
    setPermission(value: NotificationPermission) { permission = value; },
    ready: () => window.OneSignalDeferred[0](sdk),
    emitPermission: () => notifications.get('permissionChange')?.(),
    emitSubscription: () => subscriptions.get('change')?.(),
    stats: () => ({ nativeRequests, optIns, optOuts, initCalls, options }),
  };
}

test('native Allow is known immediately across reloads even with a blocked or delayed SDK', async () => {
  const env = pushBrowser('granted');
  const states: any[] = [];
  env.client.subscribePushState((state: any) => states.push(state));
  assert.deepEqual(states.at(-1), { permission: 'granted', subscribed: null });
  const pending = env.client.isPushSubscribed();
  for (const callback of env.timers.values()) callback();
  assert.equal(await pending, null, 'timeout is unknown, not a false unsubscribe');
  assert.equal(pushBrowser('granted').client.getPushState().permission, 'granted');
  env.sdk.User.PushSubscription.optedIn = true;
  await env.ready();
  assert.deepEqual(states.at(-1), { permission: 'granted', subscribed: true });
});

test('SDK init is singleton, uses Web Push namespace and separate scope, and reconciles late changes', async () => {
  const env = pushBrowser();
  const states: any[] = [];
  const unsubscribe = env.client.subscribePushState((state: any) => states.push(state));
  env.client.initOneSignal(); env.client.initOneSignal();
  assert.equal(env.window.OneSignalDeferred.length, 1);
  await env.ready();
  assert.equal(env.stats().initCalls, 1);
  assert.equal(env.stats().options.serviceWorkerPath, 'OneSignalSDKWorker.js');
  assert.equal(env.stats().options.serviceWorkerParam.scope, '/push/onesignal/');
  assert.equal(env.stats().options.autoResubscribe, true);
  assert.equal(env.stats().options.promptOptions.slidedown.prompts[0].autoPrompt, false);
  env.setPermission('granted'); env.emitPermission();
  env.sdk.User.PushSubscription.optedIn = true; env.emitSubscription();
  assert.deepEqual(states.at(-1), { permission: 'granted', subscribed: true });
  unsubscribe(); const length = states.length;
  env.setPermission('denied'); env.emitPermission();
  assert.equal(states.length, length);
});

test('Allow calls the browser synchronously, registers when SDK arrives, and never reprompts granted permission', async () => {
  const env = pushBrowser();
  const result = env.client.requestPushPermission();
  assert.equal(env.stats().nativeRequests, 1, 'request stays inside the user gesture');
  assert.equal((await result).granted, true);
  await env.ready(); await Promise.resolve();
  assert.equal(env.stats().optIns, 1);
  assert.equal((await env.client.requestPushPermission()).granted, true);
  assert.equal(env.stats().nativeRequests, 1);
});

test('iPhone browser tabs keep the Home Screen guide and do not request native permission', async () => {
  const env = pushBrowser('default', true);
  assert.equal((await env.client.requestPushPermission()).reason, 'ios_requires_pwa');
  assert.equal(env.stats().nativeRequests, 0);
});

test('permanent device On/Off controls confirm subscription and preserve an explicit opt-out across reload', async () => {
  const env=pushBrowser();
  const enabling=env.client.setDevicePushEnabled(true);
  assert.equal(env.stats().nativeRequests,1);
  await env.ready();
  assert.equal((await enabling).ok,true);
  assert.equal(env.client.getPushState().subscribed,true);
  assert.equal((await env.client.setDevicePushEnabled(false)).ok,true);
  assert.equal(env.client.getPushState().permission,'granted','turning delivery off does not misrepresent browser permission');
  assert.equal(env.client.getPushState().subscribed,false);
  const reloaded=pushBrowser('granted',false,env.saved);
  reloaded.client.initOneSignal();await reloaded.ready();
  assert.equal(reloaded.stats().options.autoResubscribe,false);
  assert.equal(reloaded.client.getPushState().subscribed,false);
});
test('native Allow never reports a successful device enable when provider registration stays unconfirmed', async () => {
  const env=pushBrowser('granted');
  env.sdk.User.PushSubscription.optIn=async()=>{};
  env.client.initOneSignal();await env.ready();
  const result=await env.client.setDevicePushEnabled(true);
  assert.equal(result.ok,false);assert.match(result.message,/not confirmed/);
});
test('a late native Allow cannot undo a newer explicit Off choice', async () => {
  const env=pushBrowser();
  const enabling=env.client.setDevicePushEnabled(true);
  const disabling=env.client.setDevicePushEnabled(false);
  await env.ready();
  await Promise.all([enabling,disabling]);
  assert.equal(env.client.getPushState().subscribed,false);
  assert.equal(env.saved.get('bsenexus_device_push_off'),'true');
});

test('preview cleanup unregisters the PWA worker without deleting existing push registration', async () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(source => source.includes('serviceWorker'))!;
  const removed: string[] = [];
  const worker = (path: string) => ({ active: { scriptURL: 'https://preview.example' + path }, unregister() { removed.push(path); } });
  vm.runInNewContext(script, {
    window: { location: { hostname: 'project-dev-preview.example', port: '' } },
    navigator: { serviceWorker: { getRegistrations: async () => [worker('/sw.js'), worker('/OneSignalSDKWorker.js')] } },
    URL, console,
  });
  await Promise.resolve();
  assert.deepEqual(removed, ['/sw.js']);
});
