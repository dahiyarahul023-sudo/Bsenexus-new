import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { redirectLegacyCalendar } from '../utils/spaRoutes.js';

test('legacy calendar links redirect before the shell and retain other URL state', async () => {
  const app = express();
  app.get('/', redirectLegacyCalendar);
  app.get('/results-calendar', (_req, res) => res.send('Scheduled BSE meetings'));
  app.use((_req, res) => res.send('Unchanged shell'));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    for (const alias of ['results-calendar', 'results', '%20RESULTS-CALENDAR%20']) {
      for (const method of ['GET', 'HEAD']) {
        const response = await fetch(`${origin}/?tab=${alias}&ref=Rahul&filter=A%26B&filter=C&next=https%3A%2F%2Fexample.com`, { method, redirect: 'manual' });
        assert.equal(response.status, 301);
        const destination = new URL(response.headers.get('location')!, origin);
        assert.equal(destination.origin, origin);
        assert.equal(destination.pathname, '/results-calendar');
        assert.equal(destination.searchParams.has('tab'), false);
        assert.equal(destination.searchParams.get('ref'), 'Rahul');
        assert.deepEqual(destination.searchParams.getAll('filter'), ['A&B', 'C']);
        assert.equal(destination.searchParams.get('next'), 'https://example.com');
      }
    }
    const followed = await fetch(origin + '/?tab=results-calendar');
    assert.equal(followed.url, origin + '/results-calendar');
    assert.equal(await followed.text(), 'Scheduled BSE meetings');
    for (const path of ['/', '/?tab=watchlists', '/?tab=settings', '/?tab=results&tab=settings', '/?tab[0]=results', '/?tab=https://example.com', '/company/TCS?tab=results', '/results-calendar?tab=results']) {
      const response = await fetch(origin + path, { redirect: 'manual' });
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.has('location'), false, path);
    }
    const post = await fetch(origin + '/?tab=results', { method: 'POST', redirect: 'manual' });
    assert.equal(post.status, 200);
    assert.equal(post.headers.has('location'), false);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
