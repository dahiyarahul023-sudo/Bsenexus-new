// Exercise the real dev module graph, lazy tabs, styles and Sentry SDK.
// APIs have empty offline fixtures; external requests never reach a provider.
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';

process.env.DISABLE_HMR = 'true';
process.env.VITE_SENTRY_DSN = '';
const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'bsenexus-dev-smoke-'));
const server = await createServer({
  cacheDir,
  server: {host: '127.0.0.1', port: 0, strictPort: false},
  plugins: [{name: 'offline-browser-fixtures', configureServer(vite) {
    vite.middlewares.use((req, res, next) => {
      if (!req.url.startsWith('/api/')) return next();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({success: true, settings: {}, items: [], data: [], announcements: [], news: [], watchlists: [], indices: [], stories: [], profile: null, enabled: false, sentryDsn: 'https://public@example.invalid/1'}));
    });
  }}],
});
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const errors = [], sockets = [], graphs = new Set();
  for (const width of [390, 768, 1440]) {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {}),
      ...(process.env.PLAYWRIGHT_CHROMIUM_ARGS ? {args: JSON.parse(process.env.PLAYWRIGHT_CHROMIUM_ARGS)} : {}),
    });
    const context = await browser.newContext({viewport: {width, height: 900}, reducedMotion: 'reduce'});
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.origin === origin ? route.continue() : route.fulfill({status: 200, contentType: 'application/json', body: '{}'});
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (/Invalid hook call|Cannot read properties of null|Rendered (?:more|fewer) hooks|beforeSendTransaction.*ignored|failed to connect to websocket/i.test(message.text())) errors.push(message.text());
    });
    page.on('websocket', socket => sockets.push(socket.url()));
    page.on('request', request => {
      const url = new URL(request.url());
      if (/react(?:-dom)?(?:_|\.|\/)|\/chunk-/.test(url.pathname) && url.searchParams.has('v')) graphs.add(url.searchParams.get('v'));
    });
    await page.goto(`${origin}/settings`, {waitUntil: 'networkidle'});
    await page.getByRole('heading', {name: 'Settings', exact: true}).waitFor();
    await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('/src/lib/sentrySdk.ts')));
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).margin), '0px', 'Vite CSS helpers must still apply Tailwind styles');
    // Use desktop navigation to change retained lazy tabs without reloading React.
    if (width >= 768) {
      const nav = page.getByRole('navigation', {name: 'Primary Navigation', exact: true});
      for (const label of ['Filings', 'Earnings Calendar', 'Market News', 'Settings', 'Filings', 'Settings']) {
        await nav.getByRole('button', {name: label, exact: true}).click();
        await page.waitForLoadState('networkidle');
        await nav.getByRole('button', {name: label, exact: true}).getAttribute('aria-current').then(value => assert.equal(value, 'page'));
        assert.equal(await page.getByText(/Something went wrong|Unable to load this section/).count(), 0);
      }
    } else {
      // The cold Settings entry exercises the same actual SettingsTab on mobile.
      assert.ok(await page.getByText('Preferences', {exact: true}).isVisible());
    }
    await context.close();
    await browser.close();
  }
  console.log(JSON.stringify({runtimeErrors: errors, hmrSockets: sockets.length, reactGraphs: graphs.size}));
  assert.deepEqual(errors, [], 'Development render/Sentry errors');
  assert.deepEqual(sockets, [], 'DISABLE_HMR=true must never open an HMR socket');
  assert.equal(graphs.size, 1, 'Every optimized React module must share one immutable browser graph');
  console.log('Development runtime passed: cold Settings, retained lazy tabs, 390/768/1440px, one React graph, CSS, Sentry, zero HMR sockets.');
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, {recursive: true, force: true});
}
