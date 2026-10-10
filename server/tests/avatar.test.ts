import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_CATALOG, avatarPhotoURL, avatarIdFromPhotoURL } from '../../src/config/avatars';
import { createAvatarSaveController } from '../../src/utils/avatarSave';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { UserAvatar } from '../../src/components/ui/UserAvatar';

test('avatar URLs identify only exact canonical catalogue assets', () => {
  for (const a of AVATAR_CATALOG) assert.equal(avatarIdFromPhotoURL(avatarPhotoURL(a.id)), a.id);
  for (const value of ['https://evil.example/avatars/v1/sprout-512.webp', 'https://bsenexus.in/avatars/v1/nope-512.webp', 'https://bsenexus.in/avatars/v1/sprout-512.webp?track=1', 'javascript:alert(1)', 'https://bsenexus.in.evil.example/avatars/v1/sprout-512.webp']) assert.equal(avatarIdFromPhotoURL(value), null);
});
test('save awaits confirmation, blocks duplicate write and applies only confirmed photo', async () => {
  const controller = createAvatarSaveController(); let confirm!: () => void; let calls = 0; const applied: string[] = [];
  const account = { uid: 'a' };
  const dependencies = { account, currentAccount: () => account, persist: async () => { calls++; await new Promise<void>(r => { confirm = r; }); }, apply: (_uid: string, url: string | null) => applied.push(url!) };
  const saving = controller.save('sprout', dependencies);
  assert.equal(applied.length, 0);
  assert.equal((await controller.save('fox', dependencies)).success, false);
  assert.equal(calls, 1); confirm(); assert.equal((await saving).success, true);
  assert.deepEqual(applied, [avatarPhotoURL('sprout')]);
});
test('failure preserves display and the next attempt can retry', async () => {
  const controller = createAvatarSaveController(); let fail = true; let applied = 0; const account = { uid: 'a' };
  const deps = { account, currentAccount: () => account, persist: async () => { if (fail) throw Error('offline'); }, apply: () => { applied++; } };
  assert.equal((await controller.save('cat', deps)).success, false); assert.equal(applied, 0);
  fail = false; assert.equal((await controller.save('cat', deps)).success, true); assert.equal(applied, 1);
});
test('logout/account switch during pending save cannot update another account', async () => {
  let uid = 'a'; let finish!: () => void; let applied = false;
  const result = createAvatarSaveController().save('owl', { account: { uid: 'a' }, currentAccount: () => ({ uid }), persist: async () => new Promise<void>(r => { finish = r; }), apply: () => { applied = true; } });
  uid = 'b'; finish(); assert.equal((await result).success, false); assert.equal(applied, false);
});
test('anonymous and invalid IDs never write; account photo restores provider photo', async () => {
  let writes = 0; const actor = { uid: 'a', isAnonymous: false, providerData: [{ photoURL: 'https://google.example/original.jpg' }] };
  const deps = { account: actor, currentAccount: () => actor, persist: async (_a: typeof actor, url: string | null) => { writes++; assert.equal(url, actor.providerData[0].photoURL); }, apply: () => {} };
  const c = createAvatarSaveController();
  assert.equal((await c.save('unknown' as any, deps)).success, false);
  assert.equal((await c.save(null, { ...deps, account: { ...actor, isAnonymous: true } })).success, false);
  assert.equal(writes, 0); assert.equal((await c.save(null, deps)).success, true); assert.equal(writes, 1);
});
test('shared avatar reserves geometry and offers responsive sources without modifying account URL', () => {
  const cutout = renderToStaticMarkup(React.createElement(UserAvatar, { photoURL: avatarPhotoURL('sprout'), size: 30 }));
  assert.match(cutout, /sprout-96\.webp/); assert.match(cutout, /srcSet=/); assert.match(cutout, /width="30"/);
  const photo = renderToStaticMarkup(React.createElement(UserAvatar, { photoURL: 'https://google.example/original.jpg', name: 'Rahul' }));
  assert.match(photo, /https:\/\/google.example\/original.jpg/); assert.doesNotMatch(photo, /srcSet=/);
  assert.match(renderToStaticMarkup(React.createElement(UserAvatar, { name: 'Rahul', photoURL: null })), />R<\/span>/);
});

test('every catalogue avatar ships transparent square assets at all responsive sizes', async () => {
  const { default: sharp } = await import('sharp');
  for (const avatar of AVATAR_CATALOG) {
    for (const size of [96, 256, 512]) {
      const path = new URL(`../../public/avatars/v1/${avatar.id}-${size}.webp`, import.meta.url);
      const image = sharp(path.pathname);
      const metadata = await image.metadata();
      assert.equal(metadata.width, size); assert.equal(metadata.height, size);
      assert.equal(metadata.hasAlpha, true);
      const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (const pixel of [0, size - 1, size * (size - 1), size * size - 1]) {
        // Resampling can leave one alpha unit at an otherwise transparent edge.
        assert.ok(data[pixel * info.channels + info.channels - 1] <= 1, `${avatar.id}: transparent corner`);
      }
    }
  }
});

test('email-only account restores initials with a confirmed null photo', async () => {
  const account = { uid: 'email-user', providerData: [{ photoURL: null }] };
  let persisted: string | null | undefined; let applied: string | null | undefined;
  const result = await createAvatarSaveController().save(null, {
    account, currentAccount: () => account,
    persist: async (_actor, photo) => { persisted = photo; },
    apply: (_uid, photo) => { applied = photo; },
  });
  assert.equal(result.success, true); assert.equal(persisted, null); assert.equal(applied, null);
});
