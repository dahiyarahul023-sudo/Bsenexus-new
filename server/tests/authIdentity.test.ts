import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { getFirebaseIdentity, hasTrustedSessionRoles } from '../security/firebaseIdentity.js';
import { getFirebaseAuth } from '../security/firebaseAdmin.js';

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'bsenexus-auth-test-')));
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.JWT_SECRET ||= 'regression-test-secret-with-no-production-access';
process.env.NODE_ENV = 'test';
const { authMiddleware, authRouter, requireAdmin } = await import('../security/auth.js');
const owner = 'dahiyarahul023@gmail.com';

test('anonymous and email-less verified claims cannot create an identity', () => {
  assert.equal(getFirebaseIdentity({ uid: 'anonymous', firebase: { sign_in_provider: 'anonymous' } }, owner), null);
  assert.equal(getFirebaseIdentity({ uid: 'email-less' }, owner), null);
  assert.equal(getFirebaseIdentity({ uid: 'anonymous', email: owner, email_verified: true, firebase: { sign_in_provider: 'anonymous' } }, owner), null);
});

test('owner privileges require verified token email; normal accounts remain normal', () => {
  assert.equal(getFirebaseIdentity({ uid: 'owner', email: owner, email_verified: false }, owner)?.isOwner, false);
  assert.equal(getFirebaseIdentity({ uid: 'owner', email: owner.toUpperCase(), email_verified: true }, owner)?.isOwner, true);
  assert.equal(getFirebaseIdentity({ uid: 'normal', email: 'normal@example.com', email_verified: true }, owner)?.isOwner, false);
  assert.equal(hasTrustedSessionRoles({ isAdmin: true, email: owner }, owner), false);
  assert.equal(hasTrustedSessionRoles({ uid: 'legacy-anonymous', email: 'normal@example.com' }, owner), false);
  assert.equal(hasTrustedSessionRoles({ uid: 'normal', email: 'normal@example.com', emailVerified: false }, owner), true);
  assert.equal(hasTrustedSessionRoles({ isOwner: true, email: owner, emailVerified: true }, owner), true);
});

async function withServer(run: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(authMiddleware);
  app.use('/auth', authRouter);
  app.get('/admin', requireAdmin, (_req, res) => res.json({ success: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const address = server.address() as { port: number };
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

test('real session route rejects anonymous tokens even with forged owner body fields', async t => {
  t.mock.method(getFirebaseAuth(), 'verifyIdToken', async () => ({ uid: 'anonymous-regression', firebase: { sign_in_provider: 'anonymous' } }));
  await withServer(async base => {
    const response = await fetch(`${base}/auth/session`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'firebase.test.token', email: owner, uid: 'owner', displayName: 'Owner' }),
    });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal((await response.json()).success, false);
  });
});

test('real middleware denies legacy privileged cookies and unverified owner tokens', async t => {
  t.mock.method(getFirebaseAuth(), 'verifyIdToken', async (token: string) => {
    if (token !== 'firebase.unverified.token') throw new Error('Invalid Firebase token');
    return { uid: 'owner', email: owner, email_verified: false };
  });
  await withServer(async base => {
    const oldToken = jwt.sign({ uid: 'old-owner', email: owner, isAdmin: true, isOwner: true }, process.env.JWT_SECRET!);
    assert.equal((await fetch(`${base}/admin`, { headers: { Cookie: `authToken=${oldToken}` } })).status, 403);
    assert.equal((await fetch(`${base}/admin`, { headers: { Authorization: 'Bearer firebase.unverified.token' } })).status, 403);
  });
});

test('real middleware permits a verified owner Firebase token', async t => {
  t.mock.method(getFirebaseAuth(), 'verifyIdToken', async () => ({ uid: 'owner', email: owner, email_verified: true }));
  await withServer(async base => {
    assert.equal((await fetch(`${base}/admin`, { headers: { Authorization: 'Bearer firebase.verified.token' } })).status, 200);
  });
});
