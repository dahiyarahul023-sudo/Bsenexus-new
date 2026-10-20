# Change: CTR Title & Meta Overhaul for Company Pages, Homepage & Generic BSE Filings

- User objective and acceptance cases:
  - User strategic diagnosis (2026-10-18):
    1. Company pages: high impressions, low CTR (Reliance 159 imp / 1.3% CTR, Maruti 117 imp / 0.9% CTR vs Sun Pharma 25 imp / 12% CTR). Need numeric, action-oriented, front-loaded title & meta tags.
    2. Generic keywords ranking pos 7-10 with 0 clicks ("bse corporate announcement", "bse filings", "bse announcement", and 203 imp query "bse corporate announcements..."). Dedicated title test required with exact-match keywords front-loaded.
    3. Homepage impressions -56% diagnosis and front-load keyword alignment without brand cannibalization.
  - Acceptance: `npm run lint`, `compile_applet`, `npm run map:check`, `node --test --import tsx server/tests/seoPrehydration.test.ts`, and `node --test --import tsx server/tests/routeResolution.test.ts` pass cleanly.
- Verified facts (file + symbol):
  - `server/services/seoPrerender.ts`: `prerenderCompanyHtml` generates SSR HTML for `/company/:symbol`.
  - `server.ts`: `renderCompanyPage` generates dynamic response for `/company/:symbol` and `/stock/:symbol`.
  - `server.ts`: `TAB_SEO_CONFIG.default`, `TAB_SEO_CONFIG.announcements`, `TAB_SEO_CONFIG.live` set `<title>` and `<meta name="description">` for root `/` and `/announcements`.
  - `index.html`: static `<title>`, `<meta name="description">`, `og:title`, `og:description`, `twitter:title`, `twitter:description` sync with default route.
  - `metadata.json`: app description synced.
- Changed source of truth:
  - `server/services/seoPrerender.ts`: clean company name (strip legal suffixes like "Limited"), high-CTR title formula: `<Clean Company Name> (<SYMBOL>) BSE Announcements & Filings Live | Bsenexus`; action-oriented meta description with BSE Scrip code, current year (2026), and latest disclosure.
  - `server.ts`: matching `renderCompanyPage` title and meta description logic; updated `TAB_SEO_CONFIG` for `default`, `announcements`, and `live` to front-load "BSE Corporate Announcements & Filings Live".
  - `index.html`: updated default title and descriptions.
  - `metadata.json`: updated description.
  - `server/tests/seoPrehydration.test.ts`: updated test 3 assertion for the new high-CTR title format.
- Impact command and affected semantic domains:
  - `npm run map:impact -- server.ts server/services/seoPrerender.ts index.html`
  - Domains: public-contract (SEO/SSR), terminal-shell.
- Related consumers: API, UI, storage/RPC, jobs, caches:
  - Googlebot / Bingbot / Web crawlers: crawlable HTML contains high-CTR, non-truncated titles and rich action-driven snippet descriptions.
  - End users: instant, clear visual titles on browser tabs and social sharing cards.
  - Cache: `pageRenderCache` caches company and tab HTML with appropriate TTLs.
- Assignment scope: frontend/backend SEO pre-hydration and metadata.
- Expected user-visible effect: Browser tab title displays "BSE Corporate Announcements & Filings Live | Bsenexus" on home, and "[Company] ([SYMBOL]) BSE Announcements & Filings Live | Bsenexus" on company profiles.
- Failure/security/concurrency cases:
  - Character bounds enforced: titles kept under 65 chars, descriptions kept under 155 chars to prevent SERP ellipsis truncation.
  - Injection safety: `escapeHtmlText` and `escapeHtmlAttr` strictly escape company names and filing subjects.
- Commands actually run and results:
  - `compile_applet`: PASS.
  - `npm run lint`: PASS (zero errors).
  - `node --test --import tsx server/tests/seoPrehydration.test.ts`: PASS (10/10).
  - `node --test --import tsx server/tests/routeResolution.test.ts`: PASS (7/7).
  - `npm run map:generate && npm run map:check`: PASS (398 files, 1070 import edges, 24 semantic domains verified).
- Delivery status: Code updated, tested, and spider-map verified.
