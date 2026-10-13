import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function boot(env: Record<string, unknown>) {
  const listeners = new Map<string, () => void>();
  const providers: string[] = [];
  const registrations: unknown[] = [];
  const self: Record<string, unknown> = {};
  const exports: any = {};
  const source = readFileSync(new URL('../../src/firebase.ts', import.meta.url), 'utf8').replaceAll('import.meta', 'runtimeMeta');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, {
    exports, self, runtimeMeta: { env }, console: { info() {} },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    window: { addEventListener(name: string, fn: () => void) { listeners.set(name, fn); }, removeEventListener(name: string) { listeners.delete(name); } },
    require(path: string) {
      if (path === 'firebase/app') return { initializeApp: () => ({}), getApps: () => [] };
      if (path === 'firebase/auth') return { getAuth: () => ({}), GoogleAuthProvider: class { setCustomParameters() {} } };
      if (path === 'firebase/app-check') return {
        ReCaptchaEnterpriseProvider: class { constructor(key: string) { providers.push(key); } },
        initializeAppCheck(_app: unknown, options: unknown) { registrations.push(options); return {}; },
      };
      throw new Error(`Unexpected startup dependency: ${path}`);
    },
  });
  return { exports, self, providers, registrations, listeners };
}

test('development preview without a registered debug token makes no App Check exchange on clicks or explicit init', () => {
  const h = boot({ DEV: true, VITE_RECAPTCHA_SITE_KEY: 'login-key' });
  assert.equal(h.registrations.length, 0);
  h.listeners.get('pointerdown')!();
  assert.equal(h.exports.initAppCheck(), null);
  assert.equal(h.registrations.length, 0);
  assert.equal(h.listeners.has('keydown'), false);
});

test('development debug token uses the dedicated registration once', () => {
  const h = boot({ DEV: true, VITE_APPCHECK_DEBUG_TOKEN: 'registered-test-token', VITE_APPCHECK_SITE_KEY: 'app-check-key', VITE_RECAPTCHA_SITE_KEY: 'login-key' });
  h.listeners.get('keydown')!();
  h.exports.initAppCheck();
  assert.equal(h.registrations.length, 1);
  assert.deepEqual(h.providers, ['app-check-key']);
  assert.equal(h.self.FIREBASE_APPCHECK_DEBUG_TOKEN, 'registered-test-token');
});

test('production keeps Enterprise attestation and cannot activate debug mode', () => {
  const h = boot({ DEV: false, VITE_APPCHECK_DEBUG_TOKEN: 'must-not-use', VITE_RECAPTCHA_SITE_KEY: 'existing-production-key' });
  h.self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  h.listeners.get('pointerdown')!();
  assert.deepEqual(h.providers, ['existing-production-key']);
  assert.equal(h.registrations.length, 1);
  assert.equal(h.self.FIREBASE_APPCHECK_DEBUG_TOKEN, undefined);
});

test('production dedicated App Check key takes precedence over login key', () => {
  const h = boot({ DEV: false, VITE_APPCHECK_SITE_KEY: 'registered-app-check-key', VITE_RECAPTCHA_SITE_KEY: 'login-key' });
  h.exports.initAppCheck();
  assert.deepEqual(h.providers, ['registered-app-check-key']);
});
