import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeLoadTimes } from '../../src/shared/performanceSummary.ts';

test('no measurements remain missing instead of invented fast averages', () => {
  assert.deepEqual(summarizeLoadTimes([]), { samples: 0, averageMs: null, p75Ms: null, p95Ms: null });
  assert.deepEqual(summarizeLoadTimes([NaN, Infinity, -1, 0]), { samples: 0, averageMs: null, p75Ms: null, p95Ms: null });
});

test('nearest-rank slow-tail percentiles retain very slow visits', () => {
  const values = [...Array(19).fill(100), 70000];
  assert.deepEqual(summarizeLoadTimes(values), { samples: 20, averageMs: 3595, p75Ms: 100, p95Ms: 100 });
  assert.deepEqual(summarizeLoadTimes([100, 200, 300, 70000]), { samples: 4, averageMs: 17650, p75Ms: 300, p95Ms: 70000 });
  assert.deepEqual(summarizeLoadTimes([4321]), { samples: 1, averageMs: 4321, p75Ms: 4321, p95Ms: 4321 });
  assert.equal(values[values.length - 1], 70000);
});
