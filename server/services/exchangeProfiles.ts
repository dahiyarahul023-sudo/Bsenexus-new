import { EXCHANGE_COMPANIES } from '../../src/config/exchangeCompanies';

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function renderExchangeProfile(company: typeof EXCHANGE_COMPANIES[number]): string {
  const url = `https://bsenexus.in/company/${company.symbol}`;
  const title = `${company.name} (${company.symbol}) — Results, Announcements & Company Profile | Bsenexus`;
  const graph = {
    '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebPage', '@id': url, url, name: title, description: company.description, mainEntity: { '@id': `${url}#company` } },
      { '@type': 'Corporation', '@id': `${url}#company`, name: company.name, tickerSymbol: company.listingLabel, url: company.website, sameAs: company.sources.map(source => source.url) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Companies', item: 'https://bsenexus.in/companies' },
        { '@type': 'ListItem', position: 2, name: company.name, item: url },
      ] },
    ],
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escape(title)}</title><meta name="description" content="${escape(company.description)}"><meta name="robots" content="index, follow"><link rel="canonical" href="${url}">
    <meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(company.description)}"><meta property="og:url" content="${url}"><meta property="og:type" content="website">
    <script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>
    <style>body{margin:0;background:#f8fafc;color:#172033;font:16px/1.7 system-ui,sans-serif}header,main,footer{max-width:960px;margin:auto;padding:24px}header,nav{display:flex;flex-wrap:wrap;gap:20px;align-items:center}header{border-bottom:1px solid #dce3eb}a{color:#047857;text-underline-offset:4px}a:focus-visible{outline:3px solid #047857;outline-offset:4px}h1{font-size:clamp(28px,5vw,42px);line-height:1.2}section{padding:24px;margin:24px 0;border:1px solid #dce3eb;border-radius:18px;background:#fff}li{margin:12px 0}dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px 24px}dd{margin:0;overflow-wrap:anywhere}small{color:#526074}@media(prefers-color-scheme:dark){body{background:#100e19;color:#f0f3f8}section{background:#191625;border-color:#373145}header{border-color:#373145}a{color:#6ee7b7}small{color:#b2b9c9}}@media(max-width:480px){header,main,footer{padding:18px}section{padding:18px}dl{grid-template-columns:1fr;gap:2px}dd{margin-bottom:12px}}</style>
    </head><body><header><a href="/">BSE Nexus</a><nav aria-label="Main"><a href="/companies">Companies</a><a href="/results-calendar">Earnings Calendar</a><a href="/announcements">Announcements</a></nav></header>
    <main><nav aria-label="Breadcrumb"><a href="/companies">Companies</a><span>${escape(company.symbol)}</span></nav><h1>${escape(company.name)}</h1><p>${escape(company.description)}</p>
    <section><h2>Company and share identity</h2><dl><dt>Company</dt><dd>${escape(company.name)}</dd><dt>Share listing</dt><dd>${escape(company.listingLabel)}</dd><dt>ISIN</dt><dd>${escape(company.isin)}</dd><dt>Business</dt><dd>Stock exchange operator</dd></dl><p>The exchange operator's shares are distinct from the market indices and from other companies listed on its exchange. ${company.symbol === 'BSE' ? 'BSE Limited shares are not the SENSEX index.' : 'NSE Limited shares are not the NIFTY 50 index.'}</p></section>
    <section><h2>${escape(company.symbol)} results and announcements</h2><p>Use the official links below for published financial results, regulatory disclosures and meeting notices. Check the reporting period and publication date on the original document.</p><ul>${company.sources.map(source => `<li><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.label)} ↗</a></li>`).join('')}</ul><p><small>This profile provides company identity and official sources. Live share prices and a scheduled earnings date are not supplied on this page.</small></p></section>
    <section><h2>Explore companies on BSE Nexus</h2><p><a href="/companies">Browse company profiles</a> or <a href="/results-calendar">open the earnings calendar</a> to view available BSE meeting dates. The calendar's All, F&amp;O Stocks and Watchlist filters retain their separate coverage.</p><p>${EXCHANGE_COMPANIES.filter(other => other.symbol !== company.symbol).map(other => `<a href="/company/${other.symbol}">${escape(other.name)}</a>`).join('')}</p></section></main>
    <footer><small>BSE Nexus is an independent research platform and is not affiliated with BSE Limited or National Stock Exchange of India Limited. Identity sources checked 21 October 2026.</small></footer></body></html>`;
}
