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
      if (req.url === '/api/market/indices') {
        return res.end(JSON.stringify({indices:[{id:'fixture',name:'Test Index',price:123.45,change:1,changePercent:0.8}],marketSession:'REGULAR'}));
      }
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
      await nav.getByRole('button', {name: 'Filings', exact: true}).click();
      await page.getByRole('button', {name: 'Open Filing Filters, Grouping, Sorting & Preferences'}).click();
      const filingFilters=page.getByRole('dialog',{name:'Filters & Preferences'});
      await filingFilters.waitFor();
      assert.equal(await filingFilters.getByRole('button',{name:'Sync Now',exact:true}).count(),0);
      await filingFilters.getByRole('button',{name:'Close filters and preferences'}).click();
      await page.getByText('Filing source status',{exact:true}).click();
      await page.getByText(/BSE source unverified/).first().waitFor();
    } else {
      // The cold Settings entry exercises the same actual SettingsTab on mobile.
      assert.ok(await page.getByText('Preferences', {exact: true}).isVisible());
      await page.getByRole('button', {name: /^Saved Notes/}).click();
      await page.waitForURL('**/settings?section=notes');
      await page.getByRole('heading', {name: 'Saved Notes', exact: true}).first().waitFor();
      await page.reload({waitUntil: 'networkidle'});
      await page.getByRole('heading', {name: 'Saved Notes', exact: true}).first().waitFor();
      await page.getByRole('button', {name: 'Back to settings'}).click();
      await page.waitForURL('**/settings');
      await page.getByRole('heading', {name: 'Settings', exact: true}).waitFor();
      await page.goBack();
      await page.getByRole('heading', {name: 'Saved Notes', exact: true}).first().waitFor();
    }
    if (width === 1440) {
      await page.goto(origin+'/announcements?design=softglass');
      await page.getByRole('heading', {name:'Filings',exact:true}).waitFor();
      assert.equal(await page.locator('html').getAttribute('data-design-theme'),'softglass');
      assert.equal(await page.getByRole('button',{name:/Switch to (light|dark) mode/i}).count(),0);
      await page.getByRole('button',{name:/Search companies, filings, commands/}).click();
      const palette=page.getByRole('dialog',{name:'Command Palette'});
      await palette.getByRole('textbox').fill('switch to light mode');
      assert.equal(await palette.getByText('Switch to Light Mode',{exact:true}).count(),0);
      await page.keyboard.press('Escape');
      await page.goto(origin+'/announcements');
      await page.getByRole('button',{name:/Switch to (light|dark) mode/i}).waitFor();
    }
    if (width === 390) {
      await page.setViewportSize({width:500,height:736});
      await page.goto(origin);
      await page.getByRole('heading',{name:'BSE filings and earnings, in one place'}).waitFor();
      const landingHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
      assert.ok(landingHeight < 6500, 'landing remains compact with examples collapsed');
      console.log('Landing height at 500 × 736:',landingHeight);
      assert.equal(await page.getByRole('link',{name:'Earnings calendar',exact:true}).first().getAttribute('href'),'/results-calendar');
      const preview=page.getByText('Preview the calendar and filing analysis',{exact:true});
      assert.equal(await page.getByText('Demo · Quarterly Earnings Deck',{exact:true}).count(),0);
      await preview.click();
      await page.getByText('Demo · Quarterly Earnings Deck',{exact:true}).waitFor();
      await preview.click();
      await page.getByText('Demo · Quarterly Earnings Deck',{exact:true}).waitFor({state:'detached'});
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.getByRole('button',{name:'Pause market ticker'}).click();
      const ticker=page.getByRole('region',{name:'Market indices'});
      assert.equal(await ticker.locator('.animate-ticker-smooth').evaluate(element=>getComputedStyle(element).animationName),'none');
      assert.equal(await ticker.locator('.market-ticker-copy[aria-hidden="true"]').count(),3);
      await page.getByRole('button',{name:'Resume market ticker'}).click();
      await page.emulateMedia({reducedMotion:'reduce'});
      assert.equal(await ticker.locator('.animate-ticker-smooth').evaluate(element=>getComputedStyle(element).animationName),'none');
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
