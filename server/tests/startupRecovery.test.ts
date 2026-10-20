import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createViteServer } from 'vite';
import { listenForStartup, resolveServerPort } from '../utils/serverStartup.js';

test('PORT supports platform configuration and rejects invalid values', () => {
  assert.equal(resolveServerPort(''), 3000);
  assert.equal(resolveServerPort('8080'), 8080);
  assert.equal(resolveServerPort('8080', ['node', 'server.ts', '--port', '3000']), 3000);
  assert.equal(resolveServerPort('8080', ['node', 'server.ts', '--port=3000']), 3000);
  for (const value of ['0', '-1', '65536', '3.5', 'abc']) {
    assert.throws(() => resolveServerPort(value), /PORT must/);
  }
});

test('occupied ports reject startup with an actionable error without disturbing the existing listener', async () => {
  const existing = createServer((_req, res) => res.end('existing listener'));
  const duplicate = createServer();
  await listenForStartup(existing, 0, '127.0.0.1');
  const port = (existing.address() as { port: number }).port;
  try {
    await assert.rejects(listenForStartup(duplicate, port, '127.0.0.1'), error => {
      assert.equal((error as NodeJS.ErrnoException).code, 'EADDRINUSE');
      assert.match((error as Error).message, /Stop the existing app process or set PORT/);
      return true;
    });
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), 'existing listener');
  } finally {
    await new Promise<void>(resolve => existing.close(() => resolve()));
  }
});

test('Vite HMR shares the HTTP listener even when the default HMR port is occupied', async () => {
  const occupiedHmr = createServer();
  const httpServer = createServer((_req, res) => res.end('shared HTTP listener'));
  let boundOccupied = false;
  try {
    await listenForStartup(occupiedHmr, 24678, '0.0.0.0');
    boundOccupied = true;
  } catch (error: any) {
    if (error.code !== 'EADDRINUSE') throw error;
  }
  const vite = await createViteServer({
    configFile: false,
    server: { middlewareMode: true, hmr: { server: httpServer } },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
  });
  try {
    await listenForStartup(httpServer, 0, '127.0.0.1');
    const port = (httpServer.address() as { port: number }).port;
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), 'shared HTTP listener');
  } finally {
    await vite.close();
    await new Promise<void>(resolve => httpServer.close(() => resolve()));
    if (boundOccupied) {
      await new Promise<void>(resolve => occupiedHmr.close(() => resolve()));
    }
  }
});
