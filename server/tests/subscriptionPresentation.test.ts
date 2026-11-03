import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subscriptionPresentation as view, type SubscriptionStatus } from '../../src/utils/subscriptionPresentation';

const now = Date.parse('2026-11-03T12:00:00Z');
const day = 86_400_000;
const base: SubscriptionStatus = { isPro: true, proExpiresAt: now - day, lastPaymentAt: null,
  plan: { label: 'Pro Monthly', validityDays: 30, amountPaise: 29900 } };

test('administrator access does not become an expired seven-day trial when no payment exists', () => {
  const v = view(base, true, now);
  assert.equal(v.planLabel, 'Administrator access');
  assert.equal(v.active, true);
  assert.equal(v.showProgress, false);
  assert.equal(v.action, 'View Pro plans');
  assert.equal(base.proExpiresAt, now - day, 'presentation never rewrites historic records');
});
test('server administrator projection is recognised without client fallback', () => {
  const v = view({ ...base, subscriptionAccess: { source: 'admin', expiresAt: 0, paidExpiresAt: 0, gift: null } }, false, now);
  assert.equal(v.source, 'admin'); assert.equal(v.showProgress, false); assert.equal(v.active, true);
});
test('paid, trial and gift access retain their own duration and effective expiry', () => {
  const paid = view({ ...base, proExpiresAt: now + 30 * day, lastPaymentAt: now }, false, now);
  assert.match(paid.planLabel, /Pro Monthly.*299.*30 days/); assert.equal(paid.days, 30); assert.equal(paid.showProgress, true);
  const trial = view({ ...base, proExpiresAt: now + 3 * day }, false, now);
  assert.match(trial.planLabel, /Pro Trial/); assert.equal(trial.days, 7);
  const gift = view({ ...base, subscriptionAccess: { source: 'gift', expiresAt: now + 90 * day, paidExpiresAt: 0,
    gift: { id: 'gift', activatedAt: now, expiresAt: now + 90 * day, validityDays: 90 } } }, false, now);
  assert.match(gift.planLabel, /Gift Pro.*90 days/); assert.equal(gift.expiry, now + 90 * day); assert.equal(gift.startedAt, now);
});
test('expired, denied and missing gift metadata never fabricate active trial access', () => {
  assert.equal(view(base, false, now).active, false);
  assert.equal(view({ ...base, isPro: false }, true, now).active, false);
  const gift = view({ ...base, subscriptionAccess: { source: 'gift', expiresAt: now + day, paidExpiresAt: 0, gift: null } }, false, now);
  assert.equal(gift.planLabel, 'Gift Pro · Complimentary');
  assert.equal(gift.showProgress, false, 'unknown gift duration is not presented as a seven-day trial');
});
