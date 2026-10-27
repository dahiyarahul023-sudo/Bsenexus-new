import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function exercise(manualRestart: boolean) {
  const dir = await mkdtemp(path.join(tmpdir(), 'bnx-backend-reload-'));
  const route = path.join(dir, 'route.ts'), entry = path.join(dir, 'server.ts');
  await writeFile(route, 'export const installed = false;');
  await writeFile(entry, `import {createServer} from 'node:http';import {installed} from './route.ts';
    const server=createServer((_req,res)=>{res.statusCode=installed?503:404;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:installed?'Gift access is not enabled yet.':'API route not found'}))});
    server.listen(0,'127.0.0.1',()=>console.log('FIXTURE_READY:'+server.address().port));
    for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));`);
  const manifest = JSON.parse(await readFile('package.json', 'utf8'));
  const devArgs = manifest.scripts.dev.split(' ');
  const entryIndex = devArgs.indexOf('server.ts');
  assert.ok(entryIndex > 0, 'development command must identify its server entry');
  const command = devArgs.slice(1, entryIndex);
  let child: ReturnType<typeof spawn>, stopped: Promise<void>;
  let output = '', errors = '', closed = false;
  function launch() {
    output = ''; errors = ''; closed = false;
    child = spawn(process.execPath, [...command, entry, ...devArgs.slice(entryIndex + 1)], {
      cwd: process.cwd(), detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '' },
    });
    child.stdout!.on('data', data => { output += data; });
    child.stderr!.on('data', data => { errors += data; });
    stopped = new Promise<void>(resolve => child.once('close', () => { closed = true; resolve(); }));
  }
  async function stop() {
    const kill = (signal: NodeJS.Signals) => {
      try { process.platform === 'win32' ? child.kill(signal) : process.kill(-child.pid!, signal); } catch {}
    };
    kill('SIGTERM');
    await Promise.race([stopped, pause(1500)]);
    if (!closed) { kill('SIGKILL'); await stopped; }
  }
  launch();
  async function eventually(expected: number) {
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline && !closed) {
      const ports = [...output.matchAll(/FIXTURE_READY:(\d+)/g)];
      if (ports.length) {
        try {
          const response = await fetch(`http://127.0.0.1:${ports.at(-1)![1]}/api/gifts/admin`, { signal: AbortSignal.timeout(500) });
          if (response.status === expected) return response;
        } catch {}
      }
      await pause(50);
    }
    throw new Error(`Expected ${expected}; output=${output}; stderr=${errors}`);
  }
  try {
    await eventually(404);
    await writeFile(route, 'export const installed = true;');
    // Keep the browser's module owner alive during edits. New API code is
    // intentionally adopted only after a coordinated preview restart/reload.
    await pause(700);
    assert.equal((await (await eventually(404)).json()).error, 'API route not found');
    assert.equal([...output.matchAll(/FIXTURE_READY:/g)].length, 1);
    if (manualRestart) {
      await stop(); launch();
      const response = await eventually(503);
      assert.equal((await response.json()).error, 'Gift access is not enabled yet.');
    }
  } finally {
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
}

test('the preview development command keeps its running server stable during source edits', () => exercise(false));
test('an intentional preview restart adopts the updated API route', () => exercise(true));
