import { test } from 'node:test';
import assert from 'node:assert/strict';
import { determinePriority, isSymbolMatch } from '../utils/helpers.js';
import { getSettings } from '../database/settingsDao.js';

test('Telegram Results Pipeline: Real financial results are classified as RESULTS (HIGH) and not suppressed by INTIMATION keyword', () => {
  const resultCases = [
    'Financial Results for the quarter and half year ended September 30, 2026 - Intimation under Regulation 33 of SEBI (LODR) Regulations, 2015',
    'Outcome of Board Meeting held on 02-Nov-2026 - Intimation under Regulation 30 & 33',
    'Intimation under Regulation 33 of SEBI (LODR) Regulations, 2015 - Financial Results',
    'Intimation of Outcome of Board Meeting - Financial Results',
    'Board Meeting Outcome for Financial Results and Intimation under Reg 33',
    'UPL Limited - Outcome of Board Meeting - Financial Results for Q2 FY26',
    'UPL Limited - Financial Results',
    'Statement of Standalone and Consolidated Unaudited Financial Results for Q2',
    'Considered and Approved the Financial Results for the Quarter Ended September 30, 2026'
  ];

  for (const subject of resultCases) {
    const priority = determinePriority(subject, '');
    assert.equal(
      priority.category, 
      'RESULTS', 
      `Expected category RESULTS for subject: "${subject}", but got: ${priority.category}`
    );
    assert.equal(
      priority.level, 
      'HIGH', 
      `Expected priority level HIGH for subject: "${subject}", but got: ${priority.level}`
    );
  }
});

test('Telegram Results Pipeline: Pre-meeting notices are correctly separated as BOARD_MEETING (MEDIUM)', () => {
  const preMeetingCases = [
    'Intimation of Board Meeting to consider financial results',
    'Notice of Board Meeting to be held on 05-Nov-2026',
    'Prior intimation of Board Meeting pursuant to Regulation 29',
    'Closure of Trading Window for financial results',
    'Board meeting intimation for considering unaudited results'
  ];

  for (const subject of preMeetingCases) {
    const priority = determinePriority(subject, '');
    assert.equal(
      priority.category, 
      'BOARD_MEETING', 
      `Expected category BOARD_MEETING for pre-meeting notice: "${subject}", but got: ${priority.category}`
    );
    assert.notEqual(priority.category, 'RESULTS');
  }
});

test('Telegram Results Pipeline: UPL and watchlist symbols match correctly', () => {
  // Direct scrip match
  assert.equal(isSymbolMatch('UPL Limited', 'Financial Results', 'UPL', '512070'), true);
  // Unmatched scrip code
  assert.equal(isSymbolMatch('UPL Limited', 'Financial Results', 'UPL', '500001'), false);
  // Missing scrip code
  assert.equal(isSymbolMatch('UPL Limited', 'Financial Results', 'UPL', ''), false);
  // Other symbol does not match
  assert.equal(isSymbolMatch('UPL Limited', 'Financial Results', 'INFY', '512070'), false);
});

test('Telegram Settings: AI summary replies are disabled by default for Telegram purity', async () => {
  const settings = await getSettings();
  assert.equal(settings.telegramAiSummaryEnabled, false, 'telegramAiSummaryEnabled must default to false');
});
