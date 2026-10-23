import test from 'node:test';
import assert from 'node:assert/strict';
import { isBseFiling } from '../../src/shared/filingSource.js';
import { mergeAnnouncementFeed } from '../../src/utils/announcementFeed.js';
test('BSE feed removes retained NSE copies without collapsing distinct BSE filings or deleting evidence', () => {
  const before = [{ newsId: 'corp_nse_a', companyName: 'Infosys' }, { newsId: 'bse-a', companyName: 'Infosys' }];
  const fresh = [{ newsId: 'bse-b', companyName: 'Infosys' }, { newsId: 'nse_old' }];
  assert.deepEqual(mergeAnnouncementFeed(before, fresh).map(x => x.newsId), ['bse-a', 'bse-b']);
  assert.equal(before.length, 2);
  for (const data of [{ source: 'NSE_LIVE_RECOVERY' }, { _source: 'NSE_LIVE_FEED' }, { pdfLink: 'https://nsearchives.nseindia.com/corporate/a.pdf' }]) assert.equal(isBseFiling(data), false);
  assert.equal(isBseFiling({ newsId: 'bse-a', pdfLink: 'https://www.bseindia.com/xml-data/corpfiling/AttachLive/a.pdf' }), true);
});
