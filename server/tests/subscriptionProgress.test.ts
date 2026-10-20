import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { subscriptionProgress } from '../../src/utils/subscriptionProgress';
const DAY = 86_400_000;
const NOW = 1_800_000_000_000;
describe('Subscription remaining-access display', () => {
  it('falls from full to half over a 30-day term', () => {
    const expiry = NOW + 30 * DAY;
    assert.deepEqual(subscriptionProgress(expiry, 30, NOW, NOW), { daysLeft: 30, percent: 100 });
    assert.deepEqual(subscriptionProgress(expiry, 30, NOW, NOW + 15 * DAY), { daysLeft: 15, percent: 50 });
  });
  it('clamps expired access and rounds partial days up', () => {
    assert.deepEqual(subscriptionProgress(NOW - 1, 30, null, NOW), { daysLeft: 0, percent: 0 });
    assert.deepEqual(subscriptionProgress(NOW + 3.5 * DAY, 7, null, NOW), { daysLeft: 4, percent: 50 });
  });
  it('accounts for prepaid extension without exceeding 100 percent', () => {
    assert.deepEqual(subscriptionProgress(NOW + 45 * DAY, 30, NOW - 15 * DAY, NOW), { daysLeft: 45, percent: 75 });
    assert.equal(subscriptionProgress(NOW + 60 * DAY, 30, null, NOW).percent, 100);
  });
  it('handles unavailable expiry without a NaN progress width', () => {
    assert.deepEqual(subscriptionProgress(NaN, 30, null, NOW), { daysLeft: 0, percent: 0 });
  });
});
