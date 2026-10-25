import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationMetrics } from '../../src/utils/navigationMetrics.ts';

test('performance samples retain slow visits and valid zero-duration network responses', () => {
  assert.deepEqual(navigationMetrics({ requestStart: 20, responseStart: 20, loadEventEnd: 70000.4, domContentLoadedEventEnd: 62500.5 }, '/results-calendar'), {
    path: '/results-calendar', measurementVersion: 2, pageLoadTimeMs: 70000, ttfbMs: 0, domContentLoadedMs: 62501,
  });
});

test('missing, unfinished and invalid timings never become invented fast measurements', () => {
  assert.equal(navigationMetrics(undefined, '/'), null);
  assert.equal(navigationMetrics({ requestStart: 0, responseStart: 0, loadEventEnd: 0, domContentLoadedEventEnd: 0 }, '/'), null);
  assert.equal(navigationMetrics({ requestStart: 50, responseStart: 30, loadEventEnd: NaN, domContentLoadedEventEnd: -10 }, '/'), null);
  assert.deepEqual(navigationMetrics({ requestStart: 5, responseStart: 15, loadEventEnd: 0, domContentLoadedEventEnd: 0 }, '/'), { path: '/', measurementVersion: 2, ttfbMs: 10 });
});
