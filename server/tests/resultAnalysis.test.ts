import test from 'node:test';
import assert from 'node:assert/strict';
import { renderGroundedResult } from '../utils/resultAnalysis.js';
import { isValidTelegramResultSummary } from '../utils/telegramResultPolicy.js';

export const extraction = {
  basis: 'consolidated', basisEvidence: 'Consolidated financial results', unit: 'crore', unitEvidence: 'Rupees in crore', kind: 'quarter', periodEnd: '2026-09-30',
  headerEvidence: 'Quarter ended 30 September 2026 30 June 2026 30 September 2025',
  columns: [{ end: '2026-09-30', kind: 'quarter' }, { end: '2026-06-30', kind: 'quarter' }, { end: '2025-09-30', kind: 'quarter' }],
  revenue: { label: 'Revenue from operations', rowEvidence: 'Revenue from operations 1,200 1,000 800', values: [1200, 1000, 800] },
  profit: { label: 'Net profit', rowEvidence: 'Net profit 180 150 100', values: [180, 150, 100] },
};
export const resultDocument = [extraction.basisEvidence, extraction.unitEvidence, extraction.headerEvidence, extraction.revenue.rowEvidence, extraction.profit.rowEvidence].join('\n');
const render = (data: any = extraction, source = resultDocument) => renderGroundedResult(JSON.stringify(data), source, '2026-09-30', 'english');

test('server calculates exact YoY/QoQ and an evidence-limited readable takeaway', () => {
  const text = render();
  assert.match(text, /YoY: \+50.00%/); assert.match(text, /YoY: \+80.00%/);
  assert.equal((text.match(/QoQ: \+20.00%/g) || []).length, 2);
  assert.match(text, /Net profit grew faster than income/);
  assert.doesNotMatch(text, /EBITDA|buy|target|demand|management/i);
});

test('small and zero PAT values remain valid evidence, not missing financial data', () => {
  for (const profit of [0, 0.5, 5, -0.5]) {
    const rowEvidence = `Net profit ${profit} 1 2`;
    const data = { ...extraction, profit: { ...extraction.profit, rowEvidence, values: [profit, 1, 2] } };
    assert.equal(isValidTelegramResultSummary(render(data, resultDocument + '\n' + rowEvidence)), true);
  }
});

test('fabricated rows, wrong columns/units/basis, wrong period and free-form AI percentages fail closed', () => {
  for (const patch of [
    { periodEnd: '2026-12-31' }, { basis: 'standalone' }, { unit: 'million' }, { unit: 'rupees' },
    { headerEvidence: 'Quarter ended 30 September 2026 30 September 2025 30 June 2026' },
    { revenue: { ...extraction.revenue, values: [1200, 800, 1000] } },
    { profit: { ...extraction.profit, rowEvidence: 'Net profit 999 150 100', values: [999, 150, 100] } },
    { profit: { ...extraction.profit, label: 'Profit before tax' } },
  ]) assert.equal(render({ ...extraction, ...patch }), '');
  assert.equal(renderGroundedResult('Revenue +999% PAT +999%', resultDocument, '2026-09-30', 'english'), '');
  assert.equal(renderGroundedResult(JSON.stringify(extraction), resultDocument, '2026-09-30', 'english', 'year'), '');
});

test('zero/negative baselines use loss transitions and never misleading growth percentages', () => {
  for (const [values, expected] of [[[180, 0, -100], 'loss to profit'], [[-50, -60, -100], 'loss narrowed'], [[-50, 60, 100], 'profit to loss']] as const) {
    const rowEvidence = `Net profit ${values.map(n => n < 0 ? '(' + -n + ')' : n).join(' ')}`;
    const data = { ...extraction, profit: { ...extraction.profit, values, rowEvidence } };
    const text = render(data, resultDocument + '\n' + rowEvidence);
    assert.match(text, new RegExp(expected)); assert.match(text, /growth % not meaningful/);
    assert.doesNotMatch(text, /Infinity|NaN/);
  }
});

test('missing comparisons are omitted, annual periods never invent QoQ, decline prose is factual', () => {
  const data = { ...extraction, columns: [extraction.columns[0]], headerEvidence: 'Quarter ended 30 September 2026',
    revenue: { ...extraction.revenue, rowEvidence: 'Revenue from operations 1,200', values: [1200] }, profit: { ...extraction.profit, rowEvidence: 'Net profit 180', values: [180] } };
  const source = [data.basisEvidence, data.unitEvidence, data.headerEvidence, data.revenue.rowEvidence, data.profit.rowEvidence].join('\n');
  assert.doesNotMatch(render(data, source), /YoY:|QoQ:/);
  const annual = { ...extraction, kind: 'year', columns: extraction.columns.map(column => ({ ...column, kind: 'year' })) };
  assert.doesNotMatch(render(annual), /QoQ:/);
  const falling = { ...extraction, revenue: { ...extraction.revenue, rowEvidence: 'Revenue from operations 400 600 800', values: [400, 600, 800] }, profit: { ...extraction.profit, rowEvidence: 'Net profit 50 60 100', values: [50, 60, 100] } };
  assert.match(render(falling, resultDocument + '\n' + falling.revenue.rowEvidence + '\n' + falling.profit.rowEvidence), /Both income and net profit fell/);
});
