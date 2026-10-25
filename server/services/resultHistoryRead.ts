import { getStockResultsHistory, autoFetchDeepHistoricalResults } from './resultsCalendarService.js';
import { historySyncStatus } from './historicalFilings.js';

/** A read returns the actual archive receipt, never a successful empty disguised as completion. */
export async function readResultHistory(symbol: string, scripCode: string, companyName: string, autoSync = true,
  deps = { read: getStockResultsHistory, start: autoFetchDeepHistoricalResults, status: historySyncStatus }) {
  let history = await deps.read(symbol, scripCode, companyName);
  const code = scripCode || history[0]?.scripCode || (/^\d{6}$/.test(symbol) ? symbol : '');
  let sync = /^\d{6}$/.test(code) ? deps.status(code, 1) : null;
  if (sync && Date.now() - sync.updatedAt > 3600_000) sync = null;
  const outcomes = history.filter(item => item.isOutcome);
  const needsHistory = outcomes.length < 4 || outcomes.some(item => !item.declarationTime || !item.pdfLink) ||
    history.some(item => item.status === 'Past Meeting');
  // Polls only read an existing job. Terminal receipts survive an hour; do not
  // turn every page read into a fresh full archive walk or a blocked-source loop.
  let historyWarning: string | undefined;
  if (autoSync && needsHistory && /^\d{6}$/.test(code) && !sync) {
    await deps.start(code, symbol, 1);
    sync = deps.status(code, 1);
    if (!sync) historyWarning = 'BSE archive could not start. Workers may be busy; retry history shortly.';
    history = await deps.read(symbol, code, companyName);
  }
  return { success: true, symbol, scripCode: code, history, historySync: sync, historyWarning };
}
