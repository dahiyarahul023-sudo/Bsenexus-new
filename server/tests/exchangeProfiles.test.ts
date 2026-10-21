import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EXCHANGE_COMPANIES, exchangeCompany } from '../../src/config/exchangeCompanies';
import { TOP_COMPANIES } from '../../src/config/topCompanies';
import { renderExchangeProfile } from '../services/exchangeProfiles';

test('exchange operator pages retain distinct correct listing identities and official sources', () => {
  assert.equal(exchangeCompany(' bse ')?.listingLabel, 'NSE: BSE');
  assert.equal(exchangeCompany('BSE')?.scripCode, '');
  assert.equal(exchangeCompany('544937')?.symbol, 'NSE');
  assert.equal(exchangeCompany('540025'), undefined);
  for (const company of EXCHANGE_COMPANIES) {
    const html = renderExchangeProfile(company);
    assert.ok(html.includes(`<h1>${company.name}</h1>`));
    assert.ok(html.includes(`rel="canonical" href="https://bsenexus.in/company/${company.symbol}"`));
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    assert.equal(graph['@graph'][1].tickerSymbol, company.listingLabel);
    assert.ok(html.includes(company.isin));
    assert.ok(html.includes('Live share prices and a scheduled earnings date are not supplied'));
    assert.ok(company.sources.every(source => /(?:bseindia|nseindia)\.com$/.test(new URL(source.url).hostname)));
    assert.equal(TOP_COMPANIES.filter(row => row.symbol === company.symbol).length, 1);
  }
});
test('generic initial document shows neutral loading without sample filings or a company directory flash', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const root = html.slice(html.indexOf('<div id="root">'), html.indexOf('<noscript>'));
  assert.ok(root.includes('Loading BSE Nexus'));
  assert.doesNotMatch(root, /RELIANCE|TATA CONSULTANCY|FINANCIAL RESULTS|<article|href="\/company/);
  assert.ok(root.includes('<!--announcements-feed-->'), 'real announcements SSR retains its dedicated insertion point');
});
