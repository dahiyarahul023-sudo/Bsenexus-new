/** Public profiles only. These records never expand watchlists or ingestion jobs. */
export const EXCHANGE_COMPANIES = [
  {
    symbol: 'BSE', scripCode: '', name: 'BSE Limited', listingLabel: 'NSE: BSE', isin: 'INE118H01025',
    sector: 'Financial Services / Stock Exchanges', category: 'Exchange operator',
    description: 'BSE Limited operates the Bombay Stock Exchange. Its own equity shares trade on the National Stock Exchange under the symbol BSE.',
    website: 'https://www.bseindia.com/',
    sources: [
      { label: 'Official NSE quote and disclosures for BSE Limited', url: 'https://www.nseindia.com/get-quotes/equity?symbol=BSE' },
      { label: 'BSE Limited financial results on NSE', url: 'https://www.nseindia.com/companies-listing/corporate-filings-financial-results?symbol=BSE' },
      { label: 'BSE Limited board meetings on NSE', url: 'https://www.nseindia.com/companies-listing/corporate-filings-event-calendar?symbol=BSE' },
    ],
  },
  {
    symbol: 'NSE', scripCode: '544937', name: 'National Stock Exchange of India Limited', listingLabel: 'BSE: 544937', isin: 'INE721I01024',
    sector: 'Financial Services / Stock Exchanges', category: 'Exchange operator',
    description: 'National Stock Exchange of India Limited operates the NSE. Its own equity shares are admitted to trading on BSE under security code 544937.',
    website: 'https://www.nseindia.com/',
    sources: [
      { label: 'Official BSE listing notice for NSE Limited', url: 'https://www.bseindia.com/downloads/UploadDocs/Notices/20260923-1/20260923-1.pdf' },
      { label: 'NSE Limited corporate announcements on BSE', url: 'https://beta.bseindia.com/stock-share-price/national-stock-exchange-of-india-ltd/nse/544937/corp-announcements/' },
      { label: 'NSE Limited investor financial results', url: 'https://www.nseindia.com/static/investor-relations/financials' },
      { label: 'NSE Limited investor announcements', url: 'https://www.nseindia.com/static/investor-relations/announcements' },
    ],
  },
] as const;

export function exchangeCompany(input: string) {
  const key = input.trim().toUpperCase();
  return EXCHANGE_COMPANIES.find(company => company.symbol === key || (company.scripCode && company.scripCode === key));
}
