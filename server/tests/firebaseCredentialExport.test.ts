import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const moduleUrl = new URL('../security/firebaseAdmin.ts', import.meta.url).href;

for (const input of ['json', 'base64', 'individual']) {
  test(`runtime ${input} credentials cannot enter the workspace export`, () => {
    const workspace = mkdtempSync(path.join(tmpdir(), 'firebase-export-test-'));
    try {
      const result = spawnSync(process.execPath, ['--import', new URL('../../node_modules/tsx/dist/loader.mjs', import.meta.url).href, '--input-type=module', '-e', `
        import fs from 'node:fs';
        import path from 'node:path';
        import { generateKeyPairSync } from 'node:crypto';
        const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        const key = privateKey.export({ type: 'pkcs8', format: 'pem' });
        const credentials = { project_id: 'synthetic-export-test', client_email: 'unit-test@synthetic.invalid', private_key: key };
        if (${JSON.stringify(input)} === 'json') process.env.GOOGLE_APPLICATION_CREDENTIALS = JSON.stringify(credentials);
        else if (${JSON.stringify(input)} === 'base64') process.env.FIREBASE_SERVICE_ACCOUNT_KEY = Buffer.from(JSON.stringify(credentials)).toString('base64');
        else { process.env.FIREBASE_PROJECT_ID = credentials.project_id; process.env.FIREBASE_CLIENT_EMAIL = credentials.client_email; process.env.FIREBASE_PRIVATE_KEY = key; }
        const { getFirebaseAdmin } = await import(${JSON.stringify(moduleUrl)});
        const first = getFirebaseAdmin();
        const filename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        const stored = JSON.parse(fs.readFileSync(filename, 'utf8'));
        const relative = path.relative(process.cwd(), filename);
        const report = {
          outside: relative.startsWith('..' + path.sep) || path.isAbsolute(relative),
          noWorkspaceFile: !fs.existsSync(path.join(process.cwd(), 'data', 'firebase-service-account.json')),
          fileMode: fs.statSync(filename).mode & 0o777,
          dirMode: fs.statSync(path.dirname(filename)).mode & 0o777,
          sameKey: (stored.private_key || stored.privateKey) === key,
          sameApp: getFirebaseAdmin() === first,
          samePath: process.env.GOOGLE_APPLICATION_CREDENTIALS === filename,
          project: first.options.projectId
        };
        if (path.basename(path.dirname(filename)).startsWith('bsenexus-firebase-')) fs.rmSync(path.dirname(filename), { recursive: true, force: true });
        console.log(JSON.stringify(report));
      `], { cwd: workspace, env: { PATH: process.env.PATH, NODE_ENV: 'test' }, encoding: 'utf8', timeout: 15000 });
      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(result.stdout.trim().split('\n').at(-1)!);
      assert.deepEqual(report, { outside: true, noWorkspaceFile: true, fileMode: 0o600, dirMode: 0o700, sameKey: true, sameApp: true, samePath: true, project: 'synthetic-export-test' });
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
}
