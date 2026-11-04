import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ProCheckoutView } from '/src/components/ProCheckoutView.tsx';
import '/src/index.css';
createRoot(document.getElementById('root')).render(<ProCheckoutView />);
`;
const auth = `
import { useSyncExternalStore } from 'react';
let owner = 'fixture-a';
const listeners = new Set();
window.switchFixtureAccount = () => {
  owner = 'fixture-b';
  for (const listener of listeners) listener();
};
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function useAuth() {
  const uid = useSyncExternalStore(subscribe, () => owner);
  return { user: { uid, email: uid + '@example.invalid' }, isCheckoutOpen: true,
    setIsCheckoutOpen() {}, checkoutPlanId: 'pro_monthly' };
}
`;

const cacheDir = await mkdtemp(join(tmpdir(), 'checkout-recovery-'));
const orders = [];
const server = await createServer({
  cacheDir,
  server: { host: '127.0.0.1', port: 0, hmr: false },
  plugins: [{
    name: 'checkout-fixture', enforce: 'pre',
    resolveId(source, importer) {
      if (source === '/@checkout-fixture') return '\0checkout-fixture';
      if (importer && source.endsWith('/AuthContext')) return '\0checkout-auth';
      if (importer && source.endsWith('/api')) return '\0checkout-api';
    },
    async load(id) {
      if (id === '\0checkout-fixture') return (await import('esbuild')).transform(entry, { loader: 'jsx', jsx: 'automatic' }).then(result => result.code);
      if (id === '\0checkout-auth') return auth;
      if (id === '\0checkout-api') return 'export const customFetch = (...args) => fetch(...args);';
    },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (req.url === '/fixture') {
          res.setHeader('Content-Type', 'text/html');
          return res.end(await vite.transformIndexHtml(req.url, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@checkout-fixture"></script></body></html>'));
        }
        if (req.url !== '/api/payments/create-order') return next();
        const body = [];
        for await (const chunk of req) body.push(chunk);
        orders.push(JSON.parse(Buffer.concat(body).toString()));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, orderId: 'BN_FIXTURE', paymentSessionId: 'synthetic-session', mode: 'sandbox' }));
      });
    },
  }],
});
const sdkUrl = 'https://sdk.cashfree.com/js/v3/cashfree.js';
let browser;
try {
  await server.listen();
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  let sdkRequests = 0;
  const sdk = 'window.Cashfree = ({mode}) => ({checkout: async options => { window.fixtureCheckout = {mode, ...options}; }});';
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(origin)) return route.continue();
    if (url === sdkUrl) {
      if (++sdkRequests === 1) return route.abort('failed');
      return route.fulfill({ contentType: 'application/javascript', body: sdk });
    }
    return route.abort();
  });
  await page.goto(origin + '/fixture');
  await page.getByRole('button', { name: /^Continue/ }).click();
  const pay = page.getByRole('button', { name: /^Pay ₹/ });
  await pay.click();
  await page.getByRole('alert').getByText(/could not load the payment gateway/i).waitFor();
  assert.equal(orders.length, 0, 'SDK failure must not create an order');
  await pay.click();
  await page.waitForFunction(() => Boolean(window.fixtureCheckout));
  assert.equal(sdkRequests, 2, 'retry must request a fresh SDK script');
  assert.deepEqual(orders, [{ planId: 'pro_monthly' }]);
  assert.deepEqual(await page.evaluate(() => window.fixtureCheckout), {
    mode: 'sandbox', paymentSessionId: 'synthetic-session', redirectTarget: '_self',
  });

  const accountPage = await browser.newPage({ viewport: { width: 1440, height: 936 } });
  let sdkRequested, releaseSdk;
  const requested = new Promise(resolve => { sdkRequested = resolve; });
  const release = new Promise(resolve => { releaseSdk = resolve; });
  await accountPage.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(origin)) return route.continue();
    if (url !== sdkUrl) return route.abort();
    sdkRequested();
    await release;
    return route.fulfill({ contentType: 'application/javascript', body: sdk });
  });
  await accountPage.goto(origin + '/fixture');
  await accountPage.getByRole('button', { name: /^Continue/ }).click();
  await accountPage.getByRole('button', { name: /^Pay ₹/ }).click();
  await requested;
  await accountPage.evaluate(() => window.switchFixtureAccount());
  releaseSdk();
  await accountPage.waitForFunction(() => typeof window.Cashfree === 'function');
  const newContinue = accountPage.getByRole('button', { name: /^Continue/ });
  await newContinue.waitFor();
  assert.equal(orders.length, 1, 'previous account may not create a new order after switch');
  assert.equal(await accountPage.evaluate(() => window.fixtureCheckout), undefined);
  await accountPage.evaluate(() => {
    window.Cashfree = () => ({ checkout: async () => ({ error: { message: 'synthetic SDK error' } }) });
  });
  await newContinue.click();
  const newPay = accountPage.getByRole('button', { name: /^Pay ₹/ });
  await newPay.click();
  await accountPage.getByRole('alert').getByText(/Cashfree reported a checkout error/i).waitFor();
  assert.equal(await newPay.isEnabled(), true, 'SDK error must release the checkout button');
  assert.equal(orders.length, 2, 'the gateway error must not replay order creation');

  const stalledPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await stalledPage.clock.install();
  let signalStalled, endStall;
  const stalled = new Promise(resolve => { signalStalled = resolve; });
  const finishStall = new Promise(resolve => { endStall = resolve; });
  await stalledPage.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(origin)) return route.continue();
    if (url === sdkUrl) {
      signalStalled();
      await finishStall;
    }
    return route.abort();
  });
  await stalledPage.goto(origin + '/fixture');
  await stalledPage.getByRole('button', { name: /^Continue/ }).click();
  await stalledPage.getByRole('button', { name: /^Pay ₹/ }).click();
  await stalled;
  await stalledPage.clock.fastForward(12_100);
  await stalledPage.getByRole('alert').getByText(/gateway took too long/i).waitFor();
  assert.equal(orders.length, 2, 'an SDK timeout must not create an order');
  endStall();
  console.log('Checkout fixture passed: script failure/timeout, retry, selected plan, same-tab handoff, provider error, and account-switch cancellation.');
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
