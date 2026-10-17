/** Human-reviewed backfill for the reported PNC gap. No prices or forecast fields.
 * Source verification and exact publication timestamps: rule/changes/impact-radar-integrity.md.
 * A supplied news link remains news; it never upgrades a next hearing to confirmed.
 */
export const PNC_REVIEW = {
  scripCode: '539150',
  filingUrl: 'https://www.bseindia.com/xml-data/corpfiling/AttachLive/6f64f8b2-88c9-4d15-90e7-fb4edc2a22be.pdf',
  filingAt: '2026-10-13T14:30:19Z',
  investorUrl: 'https://www.pncinfratech.com/pdfs/judgement-pronounced-by-honble-high-court-of-delhi-staying-the-debarment-orders-13-10-2026.pdf',
  orderDate: '2026-10-12',
  title: 'PNC Infratech: Delhi High Court stays NHAI debarment orders',
  information: 'The company reported that the Delhi High Court stayed NHAI debarment orders concerning PNC Infratech and Awadh Expressway. The order is dated 12 October 2026 and was downloaded by the company on 13 October. The company said existing development, construction, operation and maintenance activities remain unaffected; financial implications, if any, will be disclosed later. The investor disclosure does not give a case number.',
  news: [
    { name: 'CNBC TV18 · syndicated timestamp', url: 'https://www.cnbctv18.com/market/stocks/pnc-infratech-share-price-gets-delhi-high-court-stay-on-nhai-debarment-orders-20011236.htm', publishedAt: '2026-10-13T17:26:00Z',
      title: 'PNC Infratech gets Delhi High Court stay on NHAI debarment orders', information: 'CNBC TV18 reported the stay concerning PNC Infratech and Awadh Expressway. The syndicated record carries a timestamp after the exchange disclosure. That syndication timestamp does not establish the original first-publication time or rule out an earlier report.' },
    { name: 'Business Standard', url: 'https://www.business-standard.com/markets/news/pnc-infratech-share-price-jumps-7-after-delhi-hc-temporarily-stays-3-year-bidding-ban-126101400411_1.html', publishedAt: '2026-10-14T06:18:00Z',
      nextHearing: '2026-11-26', title: 'PNC Infratech: Business Standard reports Delhi High Court stay', information: 'Business Standard reported a stay on the NHAI bidding restriction and reported a next hearing on 26 November 2026. That future date is a news report, pending confirmation from the court record. The article describes intraday movement; final daily closes are shown separately from NSE reports.' },
  ],
} as const;
