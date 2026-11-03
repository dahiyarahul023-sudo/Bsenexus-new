import * as resultFiling from '../../src/shared/resultFiling.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { hasExactScripCode } from '../../src/shared/scripMatching.js';
import { parseBseDate } from '../utils/helpers.js';
import { calendarDayKey, projectCalendarTiming } from '../../src/shared/calendarTiming.js';

function loadService(rows: any[]) {
  const clock = Date.now();
  const source = ts.transpileModule(readFileSync('server/services/resultsCalendarService.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;

  const context = vm.createContext({
    exports: {},
    require: (path: string) => {
      if (path.endsWith('/currentResultEvidence.js')) return { verifyCurrentResultFilings: async (rows: any[]) => rows };
      if (path.endsWith('/resultFiling.js')) return resultFiling;
      if (path === 'fs') return { existsSync: () => true, readFileSync: () => JSON.stringify({ items: [], lastUpdated: clock, lastAttempt: clock, universeVersion: 'fixture' }) };
      if (path === 'path') return { join: (...parts: string[]) => parts.join('/'), dirname: () => '/tmp' };
      if (path.endsWith('/scripMatching.js')) return { hasExactScripCode };
      if (path.endsWith('/calendarTiming.js')) return { calendarDayKey, projectCalendarTiming };
      if (path.endsWith('/calendarUniverse.js')) return { FNO_CALENDAR_VERSION: 'fixture' };
      if (path.endsWith('/helpers.js')) return {
        parseBseDate,
        resolveStockDetails: async (val: string) => {
          if (val === '532978' || val === 'BAJAJFINSV') return { symbol: 'BAJAJFINSV', scripCode: '532978', companyName: 'Bajaj Finserv Ltd', companyShortName: 'Bajaj Finserv' };
          if (val === '500112' || val === 'SBIN') return { symbol: 'SBIN', scripCode: '500112', companyName: 'State Bank of India', companyShortName: 'SBI' };
          return { symbol: val, scripCode: val, companyName: val, companyShortName: val };
        }
      };
      if (path.endsWith('/supabase.js')) return { isSupabaseConfigured: () => false };
      if (path.endsWith('/circuitBreaker.js')) return { externalFeedsCircuitBreaker: { execute: async (run: any) => run() } };
      if (path.endsWith('/announcementDao.js')) return {
        getAnnouncementsForScrip: async () => rows,
        getRecentAnnouncements: async () => rows,
      };
      return {};
    },
    console, Date, Map, Set, process, URLSearchParams, AbortSignal, DOMException, setTimeout, clearTimeout
  });

  vm.runInContext(source, context);
  return context.exports as any;
}

test('Rule R20: Bajaj Finserv on 31-Jul-2026 sets 1st Filing Time to 11:56:21, not later financial results at 12:02:49', async () => {
  const filings = [
    {
      id: 'bajaj_outcome',
      scrip_cd: '532978',
      bseTime: '2026-07-31T11:56:21+05:30',
      subject: 'Board Meeting Outcome for Outcome Of Board Meeting Held On 31 July 2026',
      details: 'The Board Meeting commenced at 10:45 a.m. and concluded at 11:45 a.m.',
      pdfLink: 'https://www.bseindia.com/outcome.pdf',
    },
    {
      id: 'bajaj_securities',
      scrip_cd: '532978',
      bseTime: '2026-07-31T11:59:10+05:30',
      subject: 'Announcement under Regulation 30 (LODR)-Issue of Securities',
      details: 'Issue of ESOP',
      pdfLink: 'https://www.bseindia.com/sec.pdf',
    },
    {
      id: 'bajaj_results',
      scrip_cd: '532978',
      bseTime: '2026-07-31T12:02:49+05:30',
      subject: 'Unaudited Standalone And Consolidated Financial Results For The Quarter Ended 30 June 2026',
      details: 'Unaudited standalone and consolidated financial results for Q1 FY27',
      pdfLink: 'https://www.bseindia.com/results.pdf',
    },
    {
      id: 'bajaj_announcement',
      scrip_cd: '532978',
      bseTime: '2026-07-31T12:07:17+05:30',
      subject: 'Announcement under Regulation 30 (LODR)-Re-Insurance Business',
      details: 'Approval for re-insurance',
      pdfLink: 'https://www.bseindia.com/ann.pdf',
    }
  ];

  const service = loadService(filings);
  const history = await service.getStockResultsHistory('BAJAJFINSV', '532978');

  assert.equal(history.length, 1);
  const card = history[0];
  assert.equal(card.symbol, 'BAJAJFINSV');
  assert.equal(card.isOutcome, true);
  // Rule R20: declarationTime MUST be 11:56:21, NOT 12:02:49
  assert.equal(card.declarationTime, '11:56:21');
  assert.equal(card.submissionTimestamp, Date.parse('2026-07-31T11:56:21+05:30'));
  // All other same-day filings are preserved in followUps
  assert.equal(card.followUpCount, 3);
  assert.equal(card.followUpFilings.length, 3);
  // Detailed results PDF is available
  assert.ok(card.pdfLink);
});

test('Rule R20: SBIN on 08-May-2026 sets 1st Filing Time to 13:54:56, preserving all same-day disclosures', async () => {
  const filings = [
    {
      id: 'sbi_outcome',
      scrip_cd: '500112',
      bseTime: '2026-05-08T13:54:56+05:30',
      subject: 'Board Meeting Outcome for Outcome Of Board Meeting Held On 08.05.2026 For Financial Results And Dividend',
      details: 'Outcome of Board meeting held on 08.05.2026 for financial results and dividend',
      pdfLink: 'https://www.bseindia.com/sbi_outcome.pdf',
    },
    {
      id: 'sbi_press',
      scrip_cd: '500112',
      bseTime: '2026-05-08T14:14:20+05:30',
      subject: 'Announcement under Regulation 30 (LODR)-Press Release / Media Release',
      details: 'Press Release Q4FY26 Results',
      pdfLink: 'https://www.bseindia.com/sbi_press.pdf',
    },
    {
      id: 'sbi_presentation',
      scrip_cd: '500112',
      bseTime: '2026-05-08T14:17:38+05:30',
      subject: 'Announcement under Regulation 30 (LODR)-Investor Presentation',
      details: 'Presentation Q4FY26 Results',
      pdfLink: 'https://www.bseindia.com/sbi_deck.pdf',
    },
    {
      id: 'sbi_results',
      scrip_cd: '500112',
      bseTime: '2026-05-08T15:39:19+05:30',
      subject: 'Financial Results For The Year Ended On 31.03.2026',
      details: 'Financial Results for the Year ended on 31.03.2026',
      pdfLink: 'https://www.bseindia.com/sbi_results.pdf',
    },
    {
      id: 'sbi_dividend',
      scrip_cd: '500112',
      bseTime: '2026-05-08T15:49:50+05:30',
      subject: 'Corporate Action-Board approves Dividend',
      details: 'Dividend for FY 2024-25',
      pdfLink: 'https://www.bseindia.com/sbi_div.pdf',
    }
  ];

  const service = loadService(filings);
  const history = await service.getStockResultsHistory('SBIN', '500112');

  assert.equal(history.length, 1);
  const card = history[0];
  assert.equal(card.symbol, 'SBIN');
  assert.equal(card.isOutcome, true);
  // Rule R20: declarationTime MUST be 13:54:56, NOT 15:39:19
  assert.equal(card.declarationTime, '13:54:56');
  assert.equal(card.submissionTimestamp, Date.parse('2026-05-08T13:54:56+05:30'));
  // All 4 follow-up filings on the same day are preserved
  assert.equal(card.followUpCount, 4);
  assert.equal(card.followUpFilings.length, 4);
});

test('Rule R20: Prior intimation from morning does not steal 1st Filing Time from the outcome', async () => {
  const filings = [
    {
      id: 'morning_notice',
      scrip_cd: '532978',
      bseTime: '2026-07-31T09:15:00+05:30',
      subject: 'Prior Intimation of Board Meeting scheduled to be held on July 31, 2026',
      details: 'To consider and approve unaudited financial results',
      pdfLink: 'https://www.bseindia.com/notice.pdf',
    },
    {
      id: 'outcome_noon',
      scrip_cd: '532978',
      bseTime: '2026-07-31T11:56:21+05:30',
      subject: 'Board Meeting Outcome for Outcome Of Board Meeting Held On 31 July 2026',
      details: 'Meeting concluded at 11:45 a.m.',
      pdfLink: 'https://www.bseindia.com/outcome.pdf',
    },
    {
      id: 'results_noon',
      scrip_cd: '532978',
      bseTime: '2026-07-31T12:02:49+05:30',
      subject: 'Unaudited Standalone And Consolidated Financial Results For The Quarter Ended 30 June 2026',
      details: 'Financial results statement',
      pdfLink: 'https://www.bseindia.com/results.pdf',
    }
  ];

  const service = loadService(filings);
  const history = await service.getStockResultsHistory('BAJAJFINSV', '532978');

  assert.equal(history.length, 1);
  const card = history[0];
  // Morning prior notice must NOT become declarationTime
  assert.equal(card.declarationTime, '11:56:21');
  assert.notEqual(card.declarationTime, '09:15:00');
});
