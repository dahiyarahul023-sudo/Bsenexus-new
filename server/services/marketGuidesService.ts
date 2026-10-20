import { KEYWORD_GUIDES } from '../../src/content/keywordGuides.js';

/**
 * Static Market Guides provider. Existing plain-text guides remain local;
 * keyword articles share checked-in content with the frontend catalogue.
 */

export interface ServerMarketGuide {
  id: string;
  slug: string;
  title: string;
  category: string;
  readTime: string;
  summary: string;
  excerpt: string;
  date: string;
  publishedAt: string;
  editorialStatus?: string;
  author: {
    name: string;
    role: string;
    avatar?: string;
  };
  content: {
    introduction: string;
    sections: Array<{
      heading?: string;
      title?: string;
      content?: string;
      body?: string[];
      callout?: {
        type: 'warning' | 'tip' | 'info';
        text: string;
      };
    }>;
    checklist?: string[];
    conclusion: string;
  };
  faq?: Array<{
    question: string;
    answer: string;
  }>;
}

export const FALLBACK_MARKET_GUIDES: ServerMarketGuide[] = [
  {
    id: 'ipo-listings-october-5-6-2026',
    slug: 'ipo-listings-october-5-6-2026',
    title: 'IPOs Listing on October 5\u20139, 2026: Listing Prices, Dates & Subscription',
    category: 'IPO',
    readTime: '7 min read',
    summary: 'Twenty-two IPOs listed on the NSE and BSE from October 5\u20139, 2026 \u2014 six mainboard and four SME listings on October 5\u20137, nine more debuts on October 8 led by Sollfege Smart Electronics\u2019 89.82% listing premium, and three SME listings on October 9. Dates, price bands, listing prices and subscription levels, answered directly.',
    excerpt: 'Which IPOs listed from October 5\u20139, 2026, at what listing prices versus issue price, and how strongly were they subscribed? Direct answers for all twenty-two listings.',
    date: '2026-10-09',
    publishedAt: '2026-10-05T03:30:00+05:30',
    author: {
      name: 'Bsenexus Intelligence Team',
      role: 'IPO & Primary Markets'
    },
    content: {
      introduction: 'Twenty-two IPOs listed on the NSE and BSE from October 5\u20139, 2026. On Monday, October 5: Runwal Enterprises, Orient Cables (India), German Green Steel & Power, and AceVector \u2014 the parent company of Snapdeal. On Tuesday, October 6: SRIT India and Shah Investor\u2019s Home. On Wednesday, October 7, four SME IPOs debut: Vans Electroengineerings and Black Opal Consultants on the BSE SME platform, and Papadmalji Agro Foods and Green Asia Impex on NSE Emerge. Each listing\u2019s date, IPO size, price band and subscription level, answered directly below. On Thursday, October 8, nine more IPOs debuted: seven on the SME platforms \u2014 Omara Ventures India, Eventions, Dove Soft, SJP Ultrasonics, Sollfege Smart Electronics, Shree TNB Polymers and EverestIMS Technologies \u2014 and two on the mainboards: Vishal Nirmiti and Nityas Gems & Jewellery. On Friday, October 9, three SME IPOs debut on the BSE SME platform: Acme India Industries, Paramount Syntex and TNA Solutions.',
      sections: [
        {
          heading: 'Runwal Enterprises \u2014 listed Monday, October 5, 2026',
          title: 'Runwal Enterprises \u2014 listed Monday, October 5, 2026',
          content: 'Runwal Enterprises listed on the NSE and BSE on Monday, October 5, 2026. The Rs 500-crore IPO \u2014 a fully fresh issue \u2014 was priced at Rs 290\u2013305 per share and subscribed 2.5 times overall; the retail portion was subscribed 1.12 times. It debuted flat at Rs 305 on the NSE (Rs 306 on the BSE) \u2014 a 0% listing gain over the Rs 305 issue price.'
        },
        {
          heading: 'Orient Cables (India) \u2014 listed Monday, October 5, 2026',
          title: 'Orient Cables (India) \u2014 listed Monday, October 5, 2026',
          content: 'Orient Cables (India) listed on the NSE and BSE on Monday, October 5, 2026. The Rs 552-crore IPO was priced at Rs 258\u2013272 per share and subscribed about 92.3 times overall \u2014 the strongest demand of this week\u2019s listings, with QIB demand at 182.8 times. It listed at Rs 450 \u2014 a 65.44% premium over the Rs 272 issue price, the biggest listing gain of the day.'
        },
        {
          heading: 'German Green Steel & Power \u2014 listed Monday, October 5, 2026',
          title: 'German Green Steel & Power \u2014 listed Monday, October 5, 2026',
          content: 'German Green Steel & Power listed on the NSE and BSE on Monday, October 5, 2026. The Rs 303.9-crore IPO was priced at Rs 132\u2013139 per share and subscribed about 29 times. It listed at Rs 142 on the NSE (Rs 143 on the BSE) \u2014 about 2.2% above the Rs 139 issue price.'
        },
        {
          heading: 'AceVector (Snapdeal\u2019s parent) \u2014 listed Monday, October 5, 2026',
          title: 'AceVector (Snapdeal\u2019s parent) \u2014 listed Monday, October 5, 2026',
          content: 'AceVector \u2014 the parent company of Snapdeal \u2014 listed on the NSE and BSE on Monday, October 5, 2026. The Rs 420-crore IPO was priced at Rs 30\u201332 per share and subscribed 4.93 times. It debuted at a discount: Rs 28.32 on the NSE (Rs 28.30 on the BSE) \u2014 11.5% below the Rs 32 issue price, a loss of nearly Rs 1,730 per allotted lot.'
        },
        {
          heading: 'SRIT India \u2014 listed Tuesday, October 6, 2026',
          title: 'SRIT India \u2014 listed Tuesday, October 6, 2026',
          content: 'SRIT India listed on the NSE and BSE on Tuesday, October 6, 2026. The Rs 218.4-crore IPO was priced at Rs 123\u2013130 per share and subscribed 125.16 times overall, with NII demand at 313 times \u2014 the highest NII demand in this batch. It debuted at Rs 148 on the NSE \u2014 a 13.85% premium over the Rs 130 issue price \u2014 and at Rs 139.80 on the BSE (+7.54%).'
        },
        {
          heading: 'Shah Investor\u2019s Home \u2014 listed Tuesday, October 6, 2026',
          title: 'Shah Investor\u2019s Home \u2014 listed Tuesday, October 6, 2026',
          content: 'Shah Investor\u2019s Home listed on the NSE and BSE on Tuesday, October 6, 2026. The Rs 90.17-crore IPO was priced at Rs 159\u2013167 per share and subscribed 38.12 times. It debuted modestly higher at Rs 171 \u2014 a 2.4% premium over the Rs 167 issue price.'
        },
        {
          heading: 'Vans Electroengineerings \u2014 listed Wednesday, October 7, 2026',
          title: 'Vans Electroengineerings \u2014 listed Wednesday, October 7, 2026',
          content: 'Vans Electroengineerings listed on the BSE SME platform on Wednesday, October 7, 2026. The Rs 33.98-crore IPO \u2014 a fully fresh issue priced at Rs 112\u2013118 per share \u2014 was subscribed 628.73 times, the strongest demand of this week\u2019s listings. It debuted at Rs 224.20 \u2014 90% above the Rs 118 issue price. The Salem-based company manufactures vacuum circuit breakers and vacuum interrupters for railway electrification and is an RDSO-approved vendor to Indian Railways.'
        },
        {
          heading: 'Black Opal Consultants \u2014 listed Wednesday, October 7, 2026',
          title: 'Black Opal Consultants \u2014 listed Wednesday, October 7, 2026',
          content: 'Black Opal Consultants listed on the BSE SME platform on Wednesday, October 7, 2026. The Rs 55.08-crore IPO was priced at Rs 185\u2013197 per share and subscribed 73.80 times. It debuted at Rs 200 \u2014 1.52% above the Rs 197 issue price. The Delhi-based company provides real-estate advisory services and is investing part of the proceeds in its group entity\u2019s Ayodhya project.'
        },
        {
          heading: 'Papadmalji Agro Foods \u2014 listed Wednesday, October 7, 2026',
          title: 'Papadmalji Agro Foods \u2014 listed Wednesday, October 7, 2026',
          content: 'Papadmalji Agro Foods listed on NSE Emerge on Wednesday, October 7, 2026. The Rs 20.18-crore IPO \u2014 a fresh issue plus an offer for sale \u2014 was priced at Rs 69\u201372 per share and subscribed 2.54 times. It debuted at Rs 72.30 \u2014 a marginal 0.42% above the Rs 72 issue price. The Bikaner-based company manufactures papads and ready-to-fry snacks under the Zhakaas, Vishal, Rozana, Diamond and Papadmalji brands.'
        },
        {
          heading: 'Green Asia Impex \u2014 listed Wednesday, October 7, 2026',
          title: 'Green Asia Impex \u2014 listed Wednesday, October 7, 2026',
          content: 'Green Asia Impex listed on NSE Emerge on Wednesday, October 7, 2026. The Rs 60-crore IPO was priced at Rs 84\u201389 per share and subscribed 1.04 times \u2014 the thinnest demand of this week\u2019s four SME listings. It debuted flat at Rs 89 \u2014 essentially unchanged from the issue price. The Eluru-based company exports shrimp and is building a new seafood processing facility with the issue proceeds.'
        },
        {
          heading: 'Omara Ventures India \u2014 listed Thursday, October 8, 2026',
          title: 'Omara Ventures India \u2014 listed Thursday, October 8, 2026',
          content: 'Omara Ventures India listed on the BSE SME platform on Thursday, October 8, 2026. The Rs 41.99-crore jewellery IPO was priced at Rs 296\u2013311 per share, with the final issue price set at Rs 311. It debuted at Rs 319 \u2014 a 2.57% premium \u2014 and traded higher through the morning, touching Rs 333.95 (+7.38%) within hours of listing.'
        },
        {
          heading: 'Eventions \u2014 listed Thursday, October 8, 2026',
          title: 'Eventions \u2014 listed Thursday, October 8, 2026',
          content: 'Eventions listed on NSE Emerge on Thursday, October 8, 2026. The roughly Rs 38-crore event-management IPO was priced at Rs 112\u2013118 per share, with the final issue price at Rs 118. It debuted at Rs 111 \u2014 a 5.93% discount \u2014 and slid further in early trade to Rs 105.45 (\u201310.64%), the weakest debut of the day.'
        },
        {
          heading: 'Dove Soft \u2014 listed Thursday, October 8, 2026',
          title: 'Dove Soft \u2014 listed Thursday, October 8, 2026',
          content: 'Dove Soft listed on the BSE SME platform on Thursday, October 8, 2026. The Rs 73.26-crore IPO was priced at Rs 104\u2013111 per share and subscribed 1.36 times. It debuted at Rs 110.30 \u2014 a marginal 0.63% below the Rs 111 issue price \u2014 a flat-to-soft start in line with its modest subscription demand.'
        },
        {
          heading: 'SJP Ultrasonics \u2014 listed Thursday, October 8, 2026',
          title: 'SJP Ultrasonics \u2014 listed Thursday, October 8, 2026',
          content: 'SJP Ultrasonics listed on the BSE SME platform on Thursday, October 8, 2026. The Rs 23.45-crore IPO carried a fixed issue price of Rs 67 per share. It debuted at Rs 74.20 \u2014 a 10.75% premium \u2014 a solid green debut and one of the stronger listings among the October 8 SME names.'
        },
        {
          heading: 'Sollfege Smart Electronics \u2014 listed Thursday, October 8, 2026',
          title: 'Sollfege Smart Electronics \u2014 listed Thursday, October 8, 2026',
          content: 'Sollfege Smart Electronics listed on the BSE SME platform on Thursday, October 8, 2026 at a fixed issue price of Rs 55 per share. It debuted at Rs 104.40 \u2014 an 89.82% premium \u2014 the blockbuster debut of the day, nearly doubling allotted investors\u2019 money at the opening bell.'
        },
        {
          heading: 'Shree TNB Polymers \u2014 listed Thursday, October 8, 2026',
          title: 'Shree TNB Polymers \u2014 listed Thursday, October 8, 2026',
          content: 'Shree TNB Polymers listed on the BSE SME platform on Thursday, October 8, 2026. The IPO was priced at Rs 50\u201353 per share with the final issue price at Rs 53. It debuted at Rs 60 \u2014 a 13.21% premium. Please note: the Rs 60 opening figure comes from a single source (5paisa\u2019s live quote) at the time of writing; confirmed numbers from other trackers were not yet available.'
        },
        {
          heading: 'EverestIMS Technologies \u2014 listed Thursday, October 8, 2026',
          title: 'EverestIMS Technologies \u2014 listed Thursday, October 8, 2026',
          content: 'EverestIMS Technologies listed on the BSE SME platform on Thursday, October 8, 2026. The IPO was priced at Rs 80\u201385 per share and subscribed about 294 times \u2014 the hottest demand among the October 8 debutants. It listed at Rs 126 \u2014 a 48.24% premium over the Rs 85 issue price \u2014 close to what the grey market had predicted.'
        },
        {
          heading: 'Vishal Nirmiti \u2014 listed Thursday, October 8, 2026',
          title: 'Vishal Nirmiti \u2014 listed Thursday, October 8, 2026',
          content: 'Vishal Nirmiti listed on the BSE and NSE mainboards on Thursday, October 8, 2026. The IPO was priced at Rs 208\u2013220 per share. It debuted at Rs 215 on both exchanges \u2014 a 2.27% discount to the Rs 220 issue price \u2014 a soft mainboard debut that started the session below water.'
        },
        {
          heading: 'Nityas Gems & Jewellery \u2014 listed Thursday, October 8, 2026',
          title: 'Nityas Gems & Jewellery \u2014 listed Thursday, October 8, 2026',
          content: 'Nityas Gems & Jewellery listed on the BSE and NSE mainboards on Thursday, October 8, 2026. The IPO was priced at Rs 70\u201375 per share. It debuted at Rs 82 on the BSE \u2014 a 9.33% premium over the Rs 75 issue price \u2014 and at Rs 80 on the NSE (+6.7%), making it the strongest mainboard debut of the day.'
        },
        {
          heading: 'Acme India Industries \u2014 listed Friday, October 9, 2026',
          title: 'Acme India Industries \u2014 listed Friday, October 9, 2026',
          content: 'Acme India Industries listed on the BSE SME platform on Friday, October 9, 2026. The Rs 121.69-crore railway-interiors IPO was priced at Rs 186\u2013196 per share, with the final issue price at Rs 196, and subscribed 115.51 times \u2014 the strongest demand among the day\u2019s three SME debutants. It listed at Rs 221 \u2014 a 12.76% premium \u2014 a solid green debut, though below what the grey market had signalled.'
        },
        {
          heading: 'Paramount Syntex \u2014 listed Friday, October 9, 2026',
          title: 'Paramount Syntex \u2014 listed Friday, October 9, 2026',
          content: 'Paramount Syntex listed on the BSE SME platform on Friday, October 9, 2026. The Rs 81.79-crore textiles IPO was priced at Rs 119\u2013127 per share, with the final issue price at Rs 127, and subscribed 1.83 times \u2014 thin NII and retail demand despite 119x QIB interest. It debuted softly: Moneycontrol\u2019s IPO tracker showed it trading around Rs 115 \u2014 about 9.45% below the issue price. Note: the exact listing-open price was not separately confirmed by a second source at the time of writing.'
        },
        {
          heading: 'TNA Solutions \u2014 listed Friday, October 9, 2026',
          title: 'TNA Solutions \u2014 listed Friday, October 9, 2026',
          content: 'TNA Solutions listed on the BSE SME platform on Friday, October 9, 2026. The Rs 37.86-crore home-textiles IPO was priced at Rs 66\u201370 per share, with the final issue price at Rs 70, and subscribed 55.20 times. It debuted at Rs 56 \u2014 a 20% discount \u2014 and then hit the 5% lower circuit at Rs 53.20, nearly 24% below the issue price. A rough debut despite strong subscription demand.'
        }
      ],
      conclusion: 'Friday\u2019s three SME debuts are done: Acme India Industries listed at Rs 221 on BSE SME (+12.76% over its Rs 196 issue price) on 115.51x demand, TNA Solutions debuted at Rs 56 (20% below its Rs 70 issue price) before hitting the 5% lower circuit at Rs 53.20, and Paramount Syntex opened softly around Rs 115 (about 9.5% below its Rs 127 issue price; the opening figure comes from a single live tracker at the time of writing). Thursday\u2019s nine listings are done: Sollfege Smart Electronics led the day, debuting at Rs 104.40 on BSE SME \u2014 89.82% above its Rs 55 issue price \u2014 followed by EverestIMS Technologies at Rs 126 (+48.24% over Rs 85) on 294x demand, SJP Ultrasonics at Rs 74.20 (+10.75% over Rs 67), Shree TNB Polymers at Rs 60 (+13.21% over Rs 53; opening figure from a single live quote at the time of writing), Omara Ventures India at Rs 319 (+2.57% over Rs 311), and Nityas Gems & Jewellery at Rs 82 on the BSE (+9.33% over Rs 75) and Rs 80 on the NSE (+6.7%). The day\u2019s weak debuts: Eventions slipped to Rs 111 (5.93% below its Rs 118 issue price), Dove Soft to Rs 110.30 (0.63% below Rs 111), and mainboard Vishal Nirmiti to Rs 215 (2.27% below Rs 220). Wednesday\u2019s four SME listings are done: Vans Electroengineerings debuted at Rs 224.20 on BSE SME \u2014 90% above its Rs 118 issue price on 628.73x demand \u2014 Black Opal Consultants listed at Rs 200 (+1.52% over Rs 197), Papadmalji Agro Foods at Rs 72.30 (+0.42% over Rs 72), and Green Asia Impex flat at Rs 89. Tuesday\u2019s two listings are done: SRIT India listed at Rs 148 on the NSE (+13.85% over Rs 130) and Rs 139.80 on the BSE (+7.54%), while Shah Investor\u2019s Home debuted at Rs 171 \u2014 a modest 2.4% premium over its Rs 167 issue price. Monday\u2019s four are in the books: Orient Cables delivered the week\u2019s standout debut (+65.44% to Rs 450), German Green Steel & Power listed modestly higher (+2.16% to Rs 142), Runwal Enterprises debuted flat at Rs 305, and AceVector slipped 11.5% to Rs 28.32. All twenty-two companies will announce their Q2 FY27 results in October\u2013November 2026; track their filings, board meetings and results on Bsenexus as the earnings season unfolds.'
    },
    faq: [
      {
        question: 'Which IPOs are listing on October 5, 2026?',
        answer: 'Four mainboard IPOs list on the NSE and BSE on Monday, October 5, 2026: Runwal Enterprises (Rs 500 crore), Orient Cables (India) (Rs 552 crore), German Green Steel & Power (Rs 303.9 crore), and AceVector, the parent company of Snapdeal (Rs 420 crore). SRIT India and Shah Investor\u2019s Home follow on Tuesday, October 6.'
      },
      {
        question: 'Which October 5 IPO saw the highest subscription?',
        answer: 'Orient Cables (India), subscribed about 92.3 times overall with QIB demand at 182.8 times. German Green Steel & Power was next at about 29 times, followed by AceVector at 4.93 times and Runwal Enterprises at 2.5 times.'
      },
      {
        question: 'At what price did these IPOs list on October 5?',
        answer: 'Runwal Enterprises listed at Rs 305 (flat vs its Rs 305 issue price), Orient Cables (India) at Rs 450 (+65.44% over Rs 272), German Green Steel & Power at Rs 142 on the NSE (+2.16% over Rs 139), and AceVector at Rs 28.32 on the NSE (11.5% below its Rs 32 issue price).'
      },
      {
        question: 'At what price did these IPOs list on October 6?',
        answer: 'SRIT India listed at Rs 148 on the NSE (+13.85% over its Rs 130 issue price) and Rs 139.80 on the BSE (+7.54%). Shah Investor\u2019s Home debuted at Rs 171 \u2014 2.4% above its Rs 167 issue price.'
      },
      {
        question: 'Which SME IPOs listed on October 7, 2026?',
        answer: 'Four SME IPOs listed on October 7, 2026. Vans Electroengineerings debuted on BSE SME at Rs 224.20 (90% above its Rs 118 issue price), Black Opal Consultants on BSE SME at Rs 200 (1.52% above Rs 197), Papadmalji Agro Foods on NSE Emerge at Rs 72.30 (0.42% above Rs 72), and Green Asia Impex on NSE Emerge at Rs 89, essentially flat to the issue price.'
      },
      {
        question: 'Which October 7 SME IPO saw the strongest subscription demand?',
        answer: 'Vans Electroengineerings, subscribed 628.73 times \u2014 the highest subscription of this week\u2019s listings. Black Opal Consultants was next at 73.80 times, followed by Papadmalji Agro Foods at 2.54 times and Green Asia Impex at 1.04 times.'
      },
      {
        question: 'Which IPOs listed on October 8, 2026, and at what prices?',
        answer: 'Nine IPOs listed on Thursday, October 8, 2026. Sollfege Smart Electronics debuted at Rs 104.40 (+89.82% over Rs 55), EverestIMS Technologies at Rs 126 (+48.24% over Rs 85), SJP Ultrasonics at Rs 74.20 (+10.75% over Rs 67), Shree TNB Polymers at Rs 60 (+13.21% over Rs 53), Omara Ventures India at Rs 319 (+2.57% over Rs 311), Nityas Gems & Jewellery at Rs 82 on the BSE (+9.33%) and Rs 80 on the NSE (+6.7%) over Rs 75. Weak debuts: Eventions at Rs 111 (5.93% below Rs 118), Dove Soft at Rs 110.30 (0.63% below Rs 111), and Vishal Nirmiti at Rs 215 (2.27% below Rs 220).'
      },
      {
        question: 'Which October 8 IPO listed at the biggest premium?',
        answer: 'Sollfege Smart Electronics, debuting at Rs 104.40 \u2014 an 89.82% premium over its Rs 55 issue price on BSE SME. EverestIMS Technologies was next at Rs 126, a 48.24% premium over its Rs 85 issue price on 294x subscription demand. All listing prices above are observed opening prices from listing day, not forecasts of future performance.'
      },
      {
        question: 'At what price did the October 9 IPOs list?',
        answer: 'All three SME IPOs listed on BSE SME on Friday, October 9, 2026. Acme India Industries debuted at Rs 221 \u2014 a 12.76% premium over its Rs 196 issue price \u2014 on 115.51x subscription demand. TNA Solutions listed at Rs 56 \u2014 a 20% discount to its Rs 70 issue price \u2014 and fell to the 5% lower circuit at Rs 53.20. Paramount Syntex debuted softly around Rs 115, about 9.5% below its Rs 127 issue price (single-tracker reading; the exact opening price was not separately confirmed). All listing prices above are observed opening levels from listing day, not forecasts of future performance.'
      }
    ]
  },
  {
    id: 'sebi-lodr-regulation-30',
    slug: 'sebi-lodr-regulation-30',
    title: 'Demystifying SEBI LODR Regulation 30: Price-Sensitive BSE Disclosures',
    category: 'Regulatory',
    readTime: '6 min read',
    summary: 'A forensic guide for retail and institutional investors to decipher mandatory corporate filings within the 30-minute regulatory window.',
    excerpt: 'How SEBI LODR Regulation 30 mandates prompt disclosure of material events and how to identify price-sensitive catalysts on Dalal Street.',
    date: '2026-09-10',
    publishedAt: '2026-09-10T09:00:00Z',
    author: {
      name: 'Bsenexus Intelligence Team',
      role: 'Compliance & Equity Research',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Under the Securities and Exchange Board of India (Listing Obligations and Disclosure Requirements) Regulations, 2015, Regulation 30 represents the single most critical bridge between listed corporations and public market integrity. Any event that can materially impact price discovery must be disseminated to the exchanges without information asymmetry.',
      sections: [
        {
          heading: 'Mandatory Disclosure Timelines: The 30-Minute & 12-Hour Windows',
          title: 'Mandatory Disclosure Timelines: The 30-Minute & 12-Hour Windows',
          content: 'SEBI mandates strict timelines under the amended LODR framework. Events originating from a Board Meeting must be filed within 30 minutes of the meeting concluding.',
          body: [
            'Board Meeting outcomes must be disclosed within 30 minutes of adjournment.',
            'Events emanating from within the listed entity must be reported within 12 hours.',
            'Events emanating from outside the listed entity must be reported within 24 hours.'
          ],
          callout: {
            type: 'warning',
            text: 'Failure to file within specified timelines prompts immediate exchange surveillance alerts.'
          }
        },
        {
          heading: 'Qualitative vs Quantitative Materiality Thresholds',
          title: 'Qualitative vs Quantitative Materiality Thresholds',
          content: 'SEBI established strict objective thresholds for materiality: 2% of consolidated turnover, 2% of net worth, or 5% of 3-year average PAT.',
          body: [
            '2% of consolidated annual revenue/turnover based on last audited statements.',
            '2% of consolidated net worth.',
            '5% of the average absolute profit/loss after tax for the preceding three audited fiscal years.'
          ]
        }
      ],
      checklist: [
        'Verify if the filing is signed by the designated Company Secretary.',
        'Check whether the Board Meeting closure timestamp matches within 30 minutes.',
        'Evaluate the event value against the trailing 12-month consolidated turnover.'
      ],
      conclusion: 'By decoding Regulation 30 filings systematically, investors can differentiate between routine PR and authentic structural catalysts.'
    }
  },
  {
    id: 'board-meeting-results-guide',
    slug: 'board-meeting-results-guide',
    title: 'How to Audit Board Meeting Agendas & Quarterly Financial Results',
    category: 'Earnings',
    readTime: '8 min read',
    summary: 'Master the quarterly results season: from trading window closure and board notice agendas to segmental revenue and margin dissection.',
    excerpt: 'Step-by-step forensic framework for evaluating quarterly financial disclosures, board agendas, and dividend declarations on BSE.',
    date: '2026-09-08',
    publishedAt: '2026-09-08T09:00:00Z',
    author: {
      name: 'Bsenexus Intelligence Team',
      role: 'Forensic Accounting & Analysis',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Every quarter, Indian listed companies must file un-audited or audited financial results accompanied by a Limited Review Report (LRR) or Independent Auditor Report.',
      sections: [
        {
          heading: 'Trading Window Closure: The Insider Safeguard',
          title: 'Trading Window Closure: The Insider Safeguard',
          content: 'The trading window closes from the end of each quarter until 48 hours after financial results are made public.',
          body: [
            'Window closes on the final calendar day of each quarter.',
            'No promoter or director may transact in equity shares during this lock-in.',
            'Trading window reopens strictly 48 hours post-dissemination.'
          ]
        },
        {
          heading: 'Standalone vs Consolidated: Which Numbers Actually Matter?',
          title: 'Standalone vs Consolidated: Which Numbers Actually Matter?',
          content: 'For companies with active operating subsidiaries, consolidated numbers are the only true representation of business economics.',
          body: [
            'Look at Consolidated Net Profit and Cash Flow to detect loss-making subsidiaries.',
            'Compare Standalone Debt vs Consolidated Debt to detect off-balance-sheet leverage.'
          ]
        }
      ],
      checklist: [
        'Check if YoY revenue expansion is driven by volume growth or one-time gains.',
        'Examine EBITDA margin trends after accounting for input costs.',
        'Review the notes to accounts for non-operating Other Income.'
      ],
      conclusion: 'Earnings reports contain immense signal when dissected with discipline.'
    }
  },
  {
    id: 'auditor-resignations-red-flags',
    slug: 'auditor-resignations-red-flags',
    title: 'Forensic Red Flags: Auditor Resignations & Secretarial Qualifications',
    category: 'Governance',
    readTime: '7 min read',
    summary: 'Why mid-term statutory auditor exits are one of the most severe red flags in Indian equities, and how SEBI circulars protect minority shareholders.',
    excerpt: 'Detailed analysis of statutory auditor mid-term resignations, Reasons for Resignation filings, and forensic warning signs.',
    date: '2026-09-02',
    publishedAt: '2026-09-02T09:00:00Z',
    author: {
      name: 'Bsenexus Intelligence Team',
      role: 'Governance & Risk Assessment',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'A sudden statutory auditor resignation during the middle of a fiscal year is historically the sharpest warning sign of aggressive accounting or governance failure.',
      sections: [
        {
          heading: 'The SEBI Circular on Auditor Resignations',
          title: 'The SEBI Circular on Auditor Resignations',
          content: 'Under SEBI circular CIR/CFD/CMD1/114/2019, auditors must provide Annexure A disclosures detailing any scope limitations.',
          body: [
            'Auditors cannot walk away without issuing required quarterly audit reviews.',
            'The resigning auditor must submit a detailed Annexure A disclosure to exchanges.'
          ]
        }
      ],
      checklist: [
        'Inspect Annexure A of the resignation filing for mentions of scope limitation.',
        'Verify if the Audit Committee conducted an exit interview.'
      ],
      conclusion: 'When an auditor resigns abruptly, prudent risk management demands swift reassessment of exposure.'
    }
  },
  {
    id: 'insider-trading-pit-regulations',
    slug: 'insider-trading-pit-regulations',
    title: 'Tracking Promoters & Insiders: SEBI PIT Regulations & Creeping Acquisitions',
    category: 'Corporate',
    readTime: '6 min read',
    summary: 'How to decode Form C disclosures, SAST creeping acquisitions, and promoter share pledges to evaluate true insider conviction.',
    excerpt: 'Actionable techniques to monitor insider transactions, promoter pledge dynamics, and SAST Substantial Acquisition filings.',
    date: '2026-08-28',
    publishedAt: '2026-08-28T09:00:00Z',
    author: {
      name: 'Bsenexus Intelligence Team',
      role: 'Capital Markets & Trading Surveillance',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'SEBI PIT and SAST regulations provide a transparent paper trail of insider transactions.',
      sections: [
        {
          heading: 'Deciphering SEBI PIT Form C Disclosures',
          title: 'Deciphering SEBI PIT Form C Disclosures',
          content: 'Transactions exceeding ₹10 Lakhs must be disclosed within two trading days under Form C.',
          body: [
            'Differentiate between open market purchases and ESOP allotments.',
            'Open market purchases signify genuine insider conviction.'
          ]
        }
      ],
      checklist: [
        'Confirm if purchases were open market.',
        'Track promoter stake vs the 75% regulatory ceiling.'
      ],
      conclusion: 'Prioritize open market promoter buying with clean balance sheets.'
    }
  },
  {
    id: 'cash-flow-forensics-india',
    slug: 'cash-flow-forensics-india',
    title: 'Cash Flow Forensics: Operating Cash Flow vs Accounting Net Profit',
    category: 'Forensics',
    readTime: '9 min read',
    summary: 'A forensic guide to auditing Cash Flow from Operations (CFO), working capital bloat, and capital expenditure quality in Indian corporations.',
    excerpt: 'How to use cash flow statements to uncover aggressive revenue recognition, uncollected trade receivables, and genuine economic earnings.',
    date: '2026-08-20',
    publishedAt: '2026-08-20T09:00:00Z',
    author: {
      name: 'Bsenexus Intelligence Team',
      role: 'Forensic Accounting',
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Profit is an accounting opinion; cash is an audited fact. Forensic cash flow analysis reveals whether reported earnings represent real money.',
      sections: [
        {
          heading: 'The CFO-to-PAT Divergence Test',
          title: 'The CFO-to-PAT Divergence Test',
          content: 'For a healthy enterprise, cumulative Cash Flow from Operations should equal or exceed Net Profit (PAT).',
          body: [
            'CFO / PAT > 1.0 indicates high-quality earnings.',
            'CFO / PAT < 0.7 indicates profits locked in unpaid receivables or unsold inventory.'
          ]
        }
      ],
      checklist: [
        'Calculate CFO / PAT across 3 consecutive fiscal years.',
        'Verify trade receivables growth does not outpace revenue growth.'
      ],
      conclusion: 'Forensic cash flow auditing cuts through accounting wizardry. Always follow the cash.'
    }
  },
  {
    id: 'bse-quarterly-results-calendar-guide',
    slug: 'bse-quarterly-results-calendar-guide',
    title: 'BSE Results Calendar Guide: How to Track Dalal Street Earnings & Board Meeting Dates',
    category: 'Earnings',
    readTime: '10 min read',
    summary: 'A complete institutional and retail guide to tracking BSE quarterly earnings dates, decoding Regulation 29 board meeting notices, trading window closures, and Limited Review Reports on Dalal Street.',
    excerpt: 'Master the quarterly results season on the Bombay Stock Exchange (BSE). Learn how to track upcoming board meeting dates, audit financial releases under SEBI LODR Regulation 33, and capture earnings moves before the broader market.',
    date: '2026-09-21',
    publishedAt: '2026-09-21T09:00:00Z',
    author: {
      name: 'Bsenexus Intelligence Team',
      role: 'Equity Research & Earnings Analysis',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Every quarter on Dalal Street, over 4,000 listed enterprises on the Bombay Stock Exchange (BSE) undergo the most consequential corporate transparency audit in global emerging markets: the quarterly financial results cycle. For active equity investors, fundamental researchers, and quantitative trading desks, tracking upcoming earnings dates is not merely an administrative exercise—it represents the primary catalyst for severe price repricing, earnings surprises, volatility expansion, and institutional capital rotation. Understanding how Indian corporations schedule board meetings, disseminate unaudited financial statements, and comply with mandatory exchange disclosures gives market participants an unassailable edge over those who rely on lagging social media reports or delayed secondary aggregators.',
      sections: [
        {
          heading: '1. The Statutory Framework: SEBI LODR Regulation 33 & The 45-Day Timeline',
          title: '1. The Statutory Framework: SEBI LODR Regulation 33 & The 45-Day Timeline',
          content: 'The regulatory timeline governing corporate financial disclosures in India is strictly enforced under Regulation 33 of the Securities and Exchange Board of India (Listing Obligations and Disclosure Requirements) Regulations, 2015. Under this mandate, all listed companies must submit their quarterly standalone and consolidated financial results to the stock exchanges within precise calendar deadlines.',
          body: [
            'For the first three fiscal quarters—Q1 (April to June), Q2 (July to September), and Q3 (October to December)—companies are legally required to file unaudited financial statements accompanied by an independent Limited Review Report (LRR) within 45 days of the close of the quarter (August 14, November 14, and February 14 respectively).',
            'For Q4 (January to March), listed companies are granted a 60-day statutory window (until May 30) if they elect to submit comprehensive audited annual financial statements directly, rather than submitting an unaudited quarterly report followed by annual numbers later.',
            'Banking institutions and non-banking financial companies (NBFCs) must additionally adhere to Reserve Bank of India (RBI) asset classification disclosures, gross non-performing asset (GNPA) reporting, and provisioning schedules alongside Regulation 33 filings.'
          ],
          callout: {
            type: 'info',
            text: 'Key Milestone Dates: Q1 results must be submitted by August 14; Q2 by November 14; Q3 by February 14; and Q4 audited results by May 30.'
          }
        },
        {
          heading: '2. Regulation 29 Prior Intimations: Spotting Board Meeting Notices in Advance',
          title: '2. Regulation 29 Prior Intimations: Spotting Board Meeting Notices in Advance',
          content: 'Companies cannot convene surprise board meetings to approve quarterly earnings. Regulation 29 of SEBI LODR requires listed entities to give stock exchanges prior written notice of the scheduled board meeting date at least two clear working days in advance, excluding the date of the notification and the date of the meeting itself.',
          body: [
            'Prior intimations submitted under Regulation 29 are cataloged under the BSE announcement sub-category "Board Meeting Intimation" or "Board Meeting to consider Financial Results".',
            'Along with considering quarterly financial results, board notices frequently specify supplementary corporate actions on the agenda, such as interim dividends, special dividends, bonus share issues, employee stock options (ESOPs), or capital fundraising via qualified institutional placements (QIPs).',
            'When a company delays its board meeting towards the very end of the 45-day deadline or repeatedly reschedules its meeting date, institutional analysts treat this as an operational friction signal requiring elevated audit scrutiny.'
          ],
          callout: {
            type: 'warning',
            text: 'Repeated rescheduling or postponement of board meetings for results consideration often signals internal audit disputes or accounting reconciliations.'
          }
        },
        {
          heading: '3. The Trading Window Closure: Insiders Locked Out of the Market',
          title: '3. The Trading Window Closure: Insiders Locked Out of the Market',
          content: 'One of the most powerful institutional safeguards in Indian capital markets is the mandatory closure of the trading window under Clause 4 of Schedule B of the SEBI (Prohibition of Insider Trading) Regulations, 2015 (PIT Regulations).',
          body: [
            'The trading window automatically closes from the end of every calendar quarter (e.g., March 31, June 30, September 30, and December 31) for all Designated Persons, Key Managerial Personnel (KMPs), directors, and promoters.',
            'The window remains strictly closed throughout the preparation of financial numbers and only reopens 48 hours after the financial results are transmitted to and disseminated by the BSE and NSE stock exchanges.',
            'The 48-hour post-results cooling period ensures that retail and institutional investors have full price-discovery access to digest the financial statements before corporate insiders can execute any equity sales or purchases.'
          ]
        },
        {
          heading: '4. Forensic Dissection: Standalone vs Consolidated & Limited Review Reports',
          title: '4. Forensic Dissection: Standalone vs Consolidated & Limited Review Reports',
          content: 'When the BSE disseminates a financial result PDF, professional equity researchers immediately isolate three core elements beyond headline revenue and profit after tax (PAT):',
          body: [
            'Standalone vs Consolidated Metrics: Standalone numbers solely document parent company operations. Consolidated numbers incorporate all domestic and overseas operating subsidiaries, joint ventures, and associates. Large divergences where standalone profits surge while consolidated earnings plummet reveal cash drains or debt buildup in subsidiary vehicles.',
            'Auditor Limited Review Report (LRR) Qualifications: Always scroll to the statutory auditor report at the conclusion of the filing. An unmodified (clean) opinion is expected; any Emphasis of Matter or Qualified Opinion regarding uncollected receivables, disputed tax liabilities, or ongoing forensic investigations represents a material investment risk.',
            'Segmental Revenue & EBIT Dissection: Multi-division conglomerates disclose revenue and margins per business segment under Ind AS 108. Dissecting which specific business unit drove growth prevents confusing cyclical commodity upticks with structural core expansion.'
          ]
        },
        {
          heading: '5. How to Track BSE Upcoming Results Live on Bsenexus',
          title: '5. How to Track BSE Upcoming Results Live on Bsenexus',
          content: 'Navigating through hundreds of exchange PDFs during peak earnings season requires systematic filtering. The Bsenexus Results Calendar terminal delivers instant clarity with zero latency:',
          body: [
            'Live 15-Second Polling: Bsenexus polls exchange servers every 15 seconds to capture board meeting announcements, date changes, and declared result PDFs within seconds of filing.',
            'Comprehensive Scope Filters: Switch effortlessly between "Upcoming Board Meetings", "Today Results", and "Historical Ledger" to isolate scheduled events across your portfolio.',
            'Instant Calendar Sync: Download .ics calendar files or add upcoming board meeting dates directly to Google Calendar with a single click to ensure you never miss an earnings call.',
            'Telegram Push Notifications: Configure your private watchlist to receive instant push alerts on mobile the millisecond a board meeting outcome or quarterly PDF is posted.'
          ]
        },
        {
          heading: '6. Frequently Asked Questions (FAQ) About BSE Results Calendar',
          title: '6. Frequently Asked Questions (FAQ) About BSE Results Calendar',
          content: 'Essential regulatory and practical answers for tracking BSE corporate earnings releases:',
          body: [
            'Q1: How far in advance must an Indian company notify BSE before holding a results meeting? Answer: Under SEBI LODR Regulation 29, listed companies must provide at least two clear working days advance notice (excluding the intimation date and meeting date).',
            'Q2: What is the deadline for filing Q1, Q2, Q3, and Q4 financial results on BSE? Answer: Unaudited results for Q1 (June ending), Q2 (September ending), and Q3 (December ending) must be filed within 45 days of the quarter ending. Audited annual Q4 results (March ending) must be filed within 60 days.',
            'Q3: Where can I find the exact board meeting outcome document on BSE? Answer: Companies upload the board meeting outcome as an official PDF under Regulation 30/33 within 30 minutes of the board meeting adjourning. On Bsenexus, these are streamed live in the Announcements Terminal.',
            'Q4: What happens if a company fails to disclose quarterly results within 45 days? Answer: The exchange issues warning notices, levies per-day financial penalties under SEBI circulars, moves the stock to surveillance or Z-group categories, and may ultimately suspend trading if non-compliance persists.'
          ]
        }
      ],
      checklist: [
        'Confirm if the board meeting agenda includes dividends, bonus shares, or stock splits.',
        'Verify trading window closure dates and ensure insider restrictions are respected.',
        'Compare standalone vs consolidated revenue, EBITDA, and net profit margins YoY.',
        'Review auditor Limited Review Report for any qualifications or emphasis of matter.',
        'Check notes to financial accounts for one-off exceptional items inflating headline PAT.'
      ],
      conclusion: 'The quarterly results calendar is Dalal Street’s ultimate reality check. By leveraging statutory timelines under SEBI LODR Regulation 33 and tracking board meeting dates via the Bsenexus Results Calendar, investors can anticipate market volatility, audit operational momentum with institutional rigor, and make evidence-based capital allocation decisions.'
    }
  },
  {
    id: 'bse-shareholding-pattern-explained',
    slug: 'bse-shareholding-pattern-explained',
    title: 'How to Read BSE Shareholding Patterns: Decoding Promoters, FIIs, DIIs & Pledged Shares',
    category: 'Corporate',
    readTime: '9 min read',
    summary: 'A masterclass on reading quarterly BSE shareholding pattern filings under SEBI LODR Regulation 31. Learn how to decode promoter stakes, institutional FII/DII inflows, pledged share risks, and retail holding traps.',
    excerpt: 'Demystifying Regulation 31 shareholding reports on the Bombay Stock Exchange. Discover how smart money analyzes promoter share pledges, tracks institutional flows, and detects governance warning signs before market repricing.',
    date: '2026-09-21',
    publishedAt: '2026-09-21T09:00:00Z',
    author: {
      name: 'Bsenexus Intelligence Team',
      role: 'Governance & Ownership Research',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'In the Indian stock market, few regulatory disclosures provide as direct a window into fundamental conviction and corporate governance as the quarterly Shareholding Pattern filed under Regulation 31 of the SEBI (Listing Obligations and Disclosure Requirements) Regulations, 2015. While financial statements reflect past operational performance and news headlines reflect current sentiment, shareholding patterns reveal where real capital is committed. Knowing who owns a company—and more crucially, who is quietly accumulating or distributing shares—allows retail investors to align their portfolios with disciplined institutional allocators while avoiding toxic governance traps.',
      sections: [
        {
          heading: '1. The Regulatory Mandate: SEBI LODR Regulation 31 Filing Requirements',
          title: '1. The Regulatory Mandate: SEBI LODR Regulation 31 Filing Requirements',
          content: 'SEBI mandates that every company listed on BSE and NSE submit a detailed, standardized shareholding pattern disclosure at specific statutory intervals:',
          body: [
            'Quarterly Filings: Within 21 calendar days of the end of each quarter (e.g., by April 21, July 21, October 21, and January 21).',
            'Capital Restructuring: At least one day prior to listing of shares pursuant to rights issues, bonus issues, preferential allotments, or conversion of warrants.',
            'Material Capital Shifts: Within 10 days of any change in capital structure that exceeds 2% of total paid-up share capital.',
            'The standardized XBRL and PDF format organizes equity ownership into three fundamental categories: Table II (Promoter & Promoter Group), Table III (Public Shareholder), and Table IV (Non-Promoter Non-Public Shareholders).'
          ],
          callout: {
            type: 'info',
            text: 'Filing Deadline: All listed companies must submit their quarterly shareholding patterns to BSE within 21 days from the end of each quarter.'
          }
        },
        {
          heading: '2. Table II: Auditing Promoter & Promoter Group Ownership',
          title: '2. Table II: Auditing Promoter & Promoter Group Ownership',
          content: 'The promoter holding represents the primary measure of skin-in-the-game. In India, minimum public shareholding rules require promoters to hold no more than 75% of total equity, ensuring at least 25% remains available for public market liquidity.',
          body: [
            'Promoter Conviction vs Stagnation: A stable or increasing promoter stake (through open market creeping acquisitions within the allowable 5% annual threshold under SEBI SAST Regulations) reflects strong insider conviction in long-term enterprise prospects.',
            'Promoter Group Fragmentation: Scrutinize whether promoter equity is held directly by individuals or through obscure private holding corporations, offshore trust structures, or overseas corporate bodies (OCBs).',
            'Successive Stake Dilution: Consistent quarter-on-quarter selling by promoters without clear explanations (such as debt deleveraging or statutory 75% compliance) is historically one of the most reliable warning signs of operational stagnation.'
          ]
        },
        {
          heading: '3. The Red Flag of Pledged Shares & Encumbrances',
          title: '3. The Red Flag of Pledged Shares & Encumbrances',
          content: 'Promoter share pledging is among the most catastrophic volatility accelerants on Dalal Street. Under Table II of Regulation 31, companies must explicitly disclose the number and percentage of promoter shares that have been pledged, encumbered, or subjected to Non-Disposal Undertakings (NDUs) as collateral for corporate loans.',
          body: [
            'The Mechanics of Pledging: Promoters pledge their equity holdings with Non-Banking Financial Companies (NBFCs) or banks to raise debt financing either for the listed entity or for private unlisted group ventures.',
            'The Liquidation Domino Effect: If the company’s stock price declines significantly, the value of the collateral drops below required loan-to-value (LTV) margin limits. If promoters cannot provide additional collateral or cash immediately, lenders invoke the pledge and dump millions of shares on the open market, triggering severe downward circuit limits.',
            'Safe Thresholds: Institutional investors typically mandate that pledged promoter shares should not exceed 5% of total promoter holding. A pledge ratio exceeding 20% to 30% indicates severe balance-sheet stress.'
          ],
          callout: {
            type: 'warning',
            text: 'High promoter pledge (>20%) coupled with a leveraged corporate balance sheet creates extreme downside tail risk during broader market corrections.'
          }
        },
        {
          heading: '4. Table III: Decoding Institutional Inflows (FIIs, DIIs & Mutual Funds)',
          title: '4. Table III: Decoding Institutional Inflows (FIIs, DIIs & Mutual Funds)',
          content: 'Public shareholding disclosures under Table III divide non-promoter equity into Institutional and Non-Institutional categories. This section contains immense institutional signal:',
          body: [
            'Foreign Institutional Investors (FIIs / FPIs): Tracks high-conviction foreign capital flows. Analyze whether institutional inflow is driven by sovereign wealth funds (e.g., GIC, Norges, Temasek) and renowned global asset managers, or anonymous offshore funds operating through single-jurisdiction shell entities.',
            'Domestic Institutional Investors (DIIs): Measures the equity held by Indian Mutual Funds, Alternative Investment Funds (AIFs), Insurance Companies (such as LIC), and scheduled commercial banks. Increasing mutual fund ownership over 3-4 consecutive quarters indicates strong domestic institutional backing.',
            'The 1% Disclosure Rule: Under SEBI regulations, any public shareholder holding 1% or more of total equity must be identified by name. Tracking notable Super Investors, prominent family offices, and renowned value investors holding >1% stakes provides high-probability research leads.'
          ]
        },
        {
          heading: '5. Non-Institutional Holdings: Spotting the Retail Traps',
          title: '5. Non-Institutional Holdings: Spotting the Retail Traps',
          content: 'The non-institutional section details holdings by Resident Individuals with nominal share capital up to ₹2 Lakhs (retail investors) and above ₹2 Lakhs (High-Net-Worth Individuals or HNIs):',
          body: [
            'The Classic Distribution Trap: When institutional FIIs and DIIs are actively exiting a troubled business while promoters are diluting their holdings, retail shareholding almost invariably surges from 10% to 25% or more as unsuspecting investors attempt to average down falling stock prices.',
            'High-Conviction Concentration: High-quality compounders typically exhibit tightly held equity where combined Promoter + FII + DII holding exceeds 75% to 85%, leaving a modest, disciplined float for public market trading.',
            'Employee Benefit Trusts & ESOP Pools: Inspect whether employee welfare trusts hold substantial equity, aligning managerial performance directly with shareholder value creation.'
          ]
        },
        {
          heading: '6. Frequently Asked Questions (FAQ) on BSE Shareholding Patterns',
          title: '6. Frequently Asked Questions (FAQ) on BSE Shareholding Patterns',
          content: 'Key questions answered about Indian equity shareholding patterns:',
          body: [
            'Q1: When must companies file their quarterly shareholding patterns on BSE? Answer: Under SEBI LODR Regulation 31, listed entities must submit their shareholding pattern within 21 days from the end of each calendar quarter.',
            'Q2: What is the maximum permissible promoter shareholding in an Indian listed company? Answer: Under SEBI minimum public shareholding (MPS) rules, promoters can hold a maximum of 75% equity. At least 25% must be held by the public to ensure fair trading liquidity.',
            'Q3: Why is a high percentage of pledged promoter shares dangerous? Answer: When promoters pledge shares to borrow capital, a sharp fall in stock prices can trigger margin calls. If promoters fail to provide extra collateral, lenders liquidate the pledged shares on the open market, causing extreme cascading price crashes.',
            'Q4: How can I identify individual marquee investors who own shares in a company? Answer: In Table III of the Regulation 31 disclosure, companies are legally required to list the specific names of all public shareholders who hold 1% or more of the total share capital.'
          ]
        }
      ],
      checklist: [
        'Verify if promoter stake has increased or remained stable over the last 4 quarters.',
        'Check Table II specifically for any pledged or encumbered promoter shares.',
        'Track combined FII and Mutual Fund holding trends to verify institutional sponsorship.',
        'Review the 1% public shareholder list for renowned value investors or family offices.',
        'Ensure retail shareholding is not surging while smart institutional capital is exiting.'
      ],
      conclusion: 'Shareholding patterns are the ultimate truth serum on Dalal Street. While management commentary can be polished and quarterly earnings can be shaped by accounting conventions, the physical movement of shares between promoters, institutions, and the public never lies. Integrating quarterly Regulation 31 audits into your investment checklist is essential for identifying high-governance compounders and preserving capital.'
    }
  },

  {
    id: 'tcs-q2-fy27-results-preview',
    slug: 'tcs-q2-fy27-results-preview',
    title: 'TCS Q2 FY27 Results Declared: Revenue Rs 73,188 Cr, PAT Rs 13,884 Cr, Rs 12 Dividend',
    category: 'Earnings',
    readTime: '5 min read',
    summary:
      'TCS declared Q2 FY27 results on October 8, 2026, after market close: revenue Rs 73,188 crore (up 11.2% YoY), PAT Rs 13,884 crore (up ~15% YoY), EBIT margin 24%, and a second interim dividend of Rs 12 per share with record date October 14. Revenue and PAT beat consensus; margins came in a shade below estimates.',
    excerpt:
      'TCS Q2 FY27 results declared on October 8: reported revenue, PAT, margins, the Rs 12 dividend and record date, plus how the numbers stack up against analyst forecasts.',
    date: '2026-10-08',
    publishedAt: '2026-10-08T19:45:00+05:30',
    author: {
      name: 'Bsenexus Intelligence Team',
      role: 'Earnings & Results'
    },
    content: {
      introduction:
        'TCS declared its Q2 FY27 results on Thursday, October 8, 2026, after market close - and beat the Street on both revenue and profit. Revenue came in at Rs 73,188 crore (up 11.2% year-on-year), ahead of the Rs 73,007 crore consensus, while PAT of Rs 13,884 crore (up ~15% YoY) edged past the Rs 13,785 crore estimate. The board also declared a second interim dividend of Rs 12 per share, with record date Wednesday, October 14, 2026. One caveat on the profit number: a couple of outlets report PAT at Rs 13,934 crore instead - the Rs 13,884 crore figure is carried by most financial newsrooms (ET Now, Economic Times, NDTV Profit) and is the headline this page uses.',
      sections: [
        {
          heading: 'TCS Q2 FY27: the headline numbers',
          title: 'TCS Q2 FY27: the headline numbers',
          content:
            'Revenue: Rs 73,188 crore, up 11.2% YoY (from Rs 65,799 crore in Q2 FY26) and up 1.3% QoQ (from Rs 72,275 crore in Q1) - a beat vs the Rs 73,007 crore consensus. PAT: Rs 13,884 crore, up about 15% YoY and 4% QoQ - a beat vs the Rs 13,785 crore consensus. Note: Business Today and businessline report PAT at Rs 13,934 crore; most outlets carry Rs 13,884 crore, which this page uses as the headline figure. EBIT: Rs 17,553 crore, up 1.4% QoQ - slightly below the Rs 17,805 crore estimate. EBIT margin: 24%, a touch below the 24.4% consensus and roughly flat versus Q1.'
        },
        {
          heading: 'Dividend: Rs 12 per share, record date October 14',
          title: 'Dividend: Rs 12 per share, record date October 14',
          content:
            'The board declared a second interim dividend of Rs 12 per equity share of face value Rs 1 for FY27. The record date is Wednesday, October 14, 2026 - shareholders on the register or depository records as of that date receive the payout, scheduled for Friday, October 30, 2026.'
        },
        {
          heading: 'What drove the quarter: deals, AI revenue and headcount',
          title: 'What drove the quarter: deals, AI revenue and headcount',
          content:
            'Constant-currency revenue grew 0.5% QoQ, with dollar revenue at $7,642 million (up 0.2% QoQ). Deal wins were strong at $9.6 billion in total contract value for the quarter. Annualised AI revenue reached $3.1 billion - over 10% of total revenue - and the quarter saw a 5-year Porsche AG partnership and the proposed MHP acquisition alongside the Best Buy India GCC transition into an AI Capability Center. Headcount stood at 5,98,056 with trailing-twelve-month attrition at 13.3%. Net margin was 19%, and net cash from operations of Rs 14,190 crore was 102.2% of net income.'
        },
        {
          heading: 'The Best Buy India GCC deal and the AI angle',
          title: 'The Best Buy India GCC deal and the AI angle',
          content:
            'Ahead of results, TCS had acquired Best Buy\u2019s India global capability centre in a multi-year deal and is converting it into an AI-native hub, redesigning workflows and building AI-driven retail applications. Morgan Stanley kept an equal-weight rating with a Rs 2,160 price target, calling the small deal strategically positive - better revenue visibility should outweigh margin dilution. The broader industry backdrop stays cautious: JM Financial says large Indian IT is entering a fourth consecutive year of subdued growth, with AI-led productivity pressure and no meaningful revival in client budgets.',
          callout: {
            type: 'info',
            text: 'This page began as a preview of analyst forecasts and was updated the evening of October 8 with the reported numbers. Forecasts (PAT ~Rs 13,785 crore, revenue ~Rs 73,007 crore, margin ~24.4%) are kept here only for comparison - they were estimates, not facts.'
          }
        }
      ],
      conclusion:
        'TCS beat the Street on the top and bottom line in Q2 FY27 - revenue Rs 73,188 crore and PAT Rs 13,884 crore both came in above consensus, while the 24% EBIT margin was a shade below estimates and roughly flat quarter-on-quarter. The Rs 12 second interim dividend (record date October 14) sweetens the outcome for shareholders. With $9.6 billion in deal wins and AI revenue crossing $3.1 billion annualised, the question for the stock is the same as on preview day: whether management\u2019s commentary on demand and AI-led pricing pressure gives the market reason to look past the margin miss. Nothing here is investment advice.'
    },
    faq: [
      {
        question: 'When did TCS declare Q2 FY27 results?',
        answer:
          'TCS declared its Q2 FY27 results (quarter ended September 30, 2026) on Thursday, October 8, 2026, after market hours. Reported: revenue Rs 73,188 crore, PAT Rs 13,884 crore, EBIT margin 24%.'
      },
      {
        question: 'What was TCS Q2 FY27 profit (PAT)?',
        answer:
          'TCS reported Q2 FY27 PAT of Rs 13,884 crore, up about 15% year-on-year and ~4% quarter-on-quarter, beating the ~Rs 13,785 crore consensus. Note: Business Today and businessline report the figure as Rs 13,934 crore; most outlets carry Rs 13,884 crore, which is the headline figure on this page.'
      },
      {
        question: 'Did TCS declare a dividend with Q2 results?',
        answer:
          'Yes. The board declared a second interim dividend of Rs 12 per equity share (face value Rs 1) for FY27. The record date is Wednesday, October 14, 2026, and the payout is scheduled for Friday, October 30, 2026.'
      },
      {
        question: 'What was TCS Q2 FY27 revenue?',
        answer:
          'TCS reported Q2 FY27 revenue of Rs 73,188 crore, up 11.2% YoY and 1.3% QoQ, beating the Rs 73,007 crore consensus. In dollar terms, revenue was $7,642 million with 0.5% constant-currency sequential growth.'
      },
      {
        question: 'What was TCS Q2 FY27 EBIT margin?',
        answer:
          'EBIT margin for Q2 FY27 was 24%, roughly flat versus Q1 and slightly below the ~24.4% consensus estimate. EBIT was Rs 17,553 crore, up 1.4% QoQ.'
      },
      {
        question: 'What is TCS\u2019s Best Buy GCC deal?',
        answer:
          'TCS acquired Best Buy\u2019s India global capability centre in a multi-year deal and plans to convert it into an AI-native hub for redesigned workflows and AI-driven retail applications. Morgan Stanley rates TCS equal-weight with a Rs 2,160 target, calling the deal strategically positive.'
      }
    ]
  },
  {
    id: 'wipro-tech-mahindra-q2-fy27-results',
    slug: 'wipro-tech-mahindra-q2-fy27-results',
    title: 'Wipro & Tech Mahindra Q2 FY27 Results: TechM 1:1 Bonus and Rs 15 Dividend; Wipro Revenue Up 9.1% as PAT Slips',
    category: 'Earnings',
    readTime: '6 min read',
    summary:
      'Wipro and Tech Mahindra both declared Q2 FY27 results on Thursday, October 15, 2026, after market hours. Tech Mahindra reported PAT of Rs 1,585.6 crore (up 32.7% YoY) with an interim dividend of Rs 15 per share and a 1:1 bonus issue. Wipro reported revenue of Rs 24,752.7 crore (up 9.1% YoY) with PAT of Rs 3,200.6 crore (down 1.4% YoY) and soft Q3 guidance.',
    excerpt:
      'October 15 results: Tech Mahindra’s PAT jump, Rs 15 dividend and first bonus since 2015; Wipro’s flat IT services quarter, margin recovery and Q3 guidance.',
    date: '2026-10-15',
    publishedAt: '2026-10-15T19:30:00+05:30',
    author: {
      name: 'Bsenexus Intelligence Team',
      role: 'Earnings & Results'
    },
    content: {
      introduction:
        'Thursday, October 15, 2026 closed the large-cap IT week with two very different reports. Tech Mahindra delivered the day’s headline: profit up by nearly a third year-on-year, plus an interim dividend and a bonus issue — its first bonus in more than a decade. Wipro, meanwhile, grew its rupee revenue on currency and acquisitions but saw profit slip, with IT services revenue essentially flat and bookings down sharply. Both sets of numbers landed after market hours; Tech Mahindra’s earnings call was scheduled for 6:00 PM IST and Wipro’s for 7:00 PM IST.',
      sections: [
        {
          heading: 'Tech Mahindra: PAT up 32.7%, Rs 15 dividend, 1:1 bonus',
          title: 'Tech Mahindra: PAT up 32.7%, Rs 15 dividend, 1:1 bonus',
          content:
            'Revenue from operations: Rs 16,180.2 crore, up 15.6% YoY (from Rs 13,994.9 crore in Q2 FY26). PAT: Rs 1,585.6 crore, up 32.7% YoY (from Rs 1,194.5 crore) and up 8.2% QoQ (from Rs 1,465.1 crore). PAT margin improved to 9.8%. EBIT margin expanded to 14.8% (from 14.4% in Q1), with EBIT reported at Rs 2,387 crore. Diluted EPS stood at Rs 17.84. Note on the revenue figure: one outlet reports revenue at Rs 15,711.9 crore, but that matches the Q1 figure and is inconsistent with the stated 9.8% PAT margin; Rs 16,180.2 crore is carried by the Economic Times and Reuters and is the headline this page uses. The board declared an interim dividend of Rs 15 per equity share (face value Rs 5, i.e. 300%) for FY27, with record date Friday, October 23, 2026, and payment scheduled by November 13, 2026. It also recommended a 1:1 bonus issue — one new fully paid-up share of Rs 5 for every existing share — subject to shareholder approval through a postal ballot, and proposed raising authorised share capital from Rs 924.3 crore to Rs 1,000 crore to facilitate the issue. The bonus record date will be announced separately. This is Tech Mahindra’s first bonus issue since March 2015.'
        },
        {
          heading: 'Tech Mahindra: deal wins, headcount and dollar revenue (single-source)',
          title: 'Tech Mahindra: deal wins, headcount and dollar revenue (single-source)',
          content:
            'The following three items come from a single outlet each and are attributed rather than asserted as confirmed: Business Today reports new deal wins with a total contract value of $1,023 million, up 25.4% YoY, headcount of 1,52,206, and trailing-twelve-month IT attrition of 11.7%. Dollar revenue was reported at $1,693 million, up about 2% QoQ from $1,660 million. Constant-currency revenue growth for the quarter could not be confirmed from a second independent source, so no CC figure is stated here.'
        },
        {
          heading: 'Wipro: revenue up 9.1%, PAT down 1.4%, IT services flat',
          title: 'Wipro: revenue up 9.1%, IT services flat',
          content:
            'Revenue from operations: Rs 24,752.7 crore, up 9.1% YoY (from Rs 22,697.3 crore) and up 1.1% QoQ (from Rs 24,478.6 crore). PAT attributable to owners: Rs 3,200.6 crore, down 1.4% YoY (from Rs 3,246.2 crore) and down 4.5% QoQ. Note: some coverage reports consolidated net income of Rs 3,199.7 crore (down 1.9% YoY from Rs 3,262.4 crore) on a total-income basis; the Rs 3,200.6 crore attributable figure is carried by Business Standard, Hindu BusinessLine and Moneycontrol and is the headline this page uses. IT services segment revenue: $2,611.5 million, down 0.1% QoQ and up 0.3% YoY; in constant currency it was flat QoQ and up 0.6% YoY. IT services operating margin: 16.5%, up 0.5 percentage points QoQ but down 0.2 points YoY. Total bookings fell to $2,595 million (down 22.9% QoQ in constant currency) and large-deal bookings to $674 million (down 58.6% QoQ). EPS rose to Rs 3.23 (up 4.2% YoY). Operating cash flow was Rs 5,300 crore, 165.8% of net income. Voluntary attrition stood at 13.8% on a trailing-twelve-month basis. No fresh dividend was announced with these results; Wipro had paid an interim dividend of Rs 2 per share in Q1 FY27.'
        },
        {
          heading: 'Wipro Q3 guidance: $2,571–2,625 million',
          title: 'Wipro Q3 guidance: $2,571–2,625 million',
          content:
            'For the quarter ending December 31, 2026, Wipro expects IT services revenue in the range of $2,571 million to $2,625 million, translating to sequential guidance of -1.5% to +0.5% in constant-currency terms. Management attributed the margin recovery to continued investment in growth and talent while expanding margins, and pointed to its consulting-led, AI-powered strategy and momentum in its AI Native Unit and AI offerings portfolio.'
        },
        {
          heading: 'Against expectations: what beat and what missed',
          title: 'Against expectations: what beat and what missed',
          content:
            'Wipro’s revenue of Rs 24,752.7 crore came in just above the Rs 24,710–24,733 crore consensus cluster, and flat constant-currency IT services growth was better than the roughly -0.75% to -1.0% sequential decline brokerages expected. The 16.5% margin also beat the ~16.0–16.26% expected range. But PAT of Rs 3,200.6 crore missed the Rs 3,248.6 crore CNBC-TV18 poll and Rs 3,306 crore Bloomberg consensus, and the bookings drop was the softest part of the print. Tech Mahindra beat across the board: PAT of Rs 1,585.6 crore topped the Rs 1,557.8–1,563 crore Kotak/Axis estimates, revenue of Rs 16,180.2 crore topped the Rs 15,948–16,111 crore estimates, and the 14.8% EBIT margin beat the ~14.5% expected. The dividend-plus-bonus decision was the day’s biggest surprise element — the bonus ratio and dividend amount had been undisclosed before the meeting.'
        }
      ],
      conclusion:
        'October 15 split the two IT majors cleanly: Tech Mahindra paired a 32.7% profit jump with a Rs 15 interim dividend and a 1:1 bonus — its first since 2015 — while Wipro grew rupee revenue 9.1% but saw profit slip 1.4%, IT services stay flat, and bookings fall sharply, with Q3 guidance pointing to another flat-to-soft quarter. For Tech Mahindra, the dates to track are the October 23 dividend record date and the separately announced bonus record date; for Wipro, whether bookings and organic growth recover in Q3. Nothing here is investment advice.'
    },
    faq: [
      {
        question: 'When did Wipro and Tech Mahindra declare Q2 FY27 results?',
        answer:
          'Both declared Q2 FY27 results (quarter ended September 30, 2026) on Thursday, October 15, 2026, after market hours. Tech Mahindra’s earnings call was scheduled for 6:00 PM IST and Wipro’s for 7:00 PM IST.'
      },
      {
        question: 'What dividend and bonus did Tech Mahindra declare with Q2 FY27 results?',
        answer:
          'Tech Mahindra declared an interim dividend of Rs 15 per equity share (face value Rs 5, i.e. 300%) with record date Friday, October 23, 2026, and payment by November 13, 2026. It also recommended a 1:1 bonus issue — one new share for every existing share — subject to shareholder approval via postal ballot; the bonus record date will be announced separately. It is the company’s first bonus since March 2015.'
      },
      {
        question: 'What was Tech Mahindra’s Q2 FY27 PAT and revenue?',
        answer:
          'Tech Mahindra reported Q2 FY27 revenue of Rs 16,180.2 crore (up 15.6% YoY) and PAT of Rs 1,585.6 crore (up 32.7% YoY, up 8.2% QoQ), with EBIT margin expanding to 14.8%. One outlet reports revenue at Rs 15,711.9 crore, but that matches the Q1 figure and conflicts with the stated 9.8% PAT margin; this page uses Rs 16,180.2 crore.'
      },
      {
        question: 'What was Wipro’s Q2 FY27 PAT and revenue?',
        answer:
          'Wipro reported Q2 FY27 revenue from operations of Rs 24,752.7 crore (up 9.1% YoY, up 1.1% QoQ) and PAT attributable to owners of Rs 3,200.6 crore (down 1.4% YoY, down 4.5% QoQ). Some coverage reports consolidated net income of Rs 3,199.7 crore on a total-income basis; this page uses the Rs 3,200.6 crore attributable figure.'
      },
      {
        question: 'What did Wipro guide for Q3 FY27?',
        answer:
          'Wipro guided Q3 FY27 IT services revenue of $2,571–2,625 million, implying a sequential constant-currency change of -1.5% to +0.5%. Q2 IT services revenue was $2,611.5 million (flat QoQ in constant currency, up 0.6% YoY) at a 16.5% operating margin.'
      },
      {
        question: 'Did Wipro declare a dividend with its Q2 FY27 results?',
        answer:
          'No fresh dividend was announced with Wipro’s Q2 FY27 results. Wipro had paid an interim dividend of Rs 2 per share in Q1 FY27.'
      }
    ]
  },
  {
    id: 'bank-q2-fy27-results-preview',
    slug: 'bank-q2-fy27-results-preview',
    title: 'Bank Q2 FY27 Results: HDFC PAT Rs 19,510 Cr, ICICI Up 20%, Axis Up 38% as NIMs Compress',
    category: 'Earnings',
    readTime: '7 min read',
    summary:
      'HDFC Bank, Axis Bank and ICICI Bank all declared Q2 FY27 results on Saturday, October 17, 2026 — the first sector-wide read after the RBI’s October 7 rate hike. ICICI beat consensus (PAT Rs 14,843 crore, up 20.1% YoY); HDFC (Rs 19,510 crore, up 4.7%) and Axis (Rs 7,003 crore, up 38%) came in just below consensus. All three saw NIMs compress on FCNR(B) deposit drag, and all three improved asset quality.',
    excerpt:
      'October 17 triple-header results: reported PAT, NII, NIM, asset quality, loan/deposit growth and CASA for HDFC Bank, Axis Bank and ICICI Bank, plus actuals vs consensus and the FCNR(B) margin story.',
    date: '2026-10-17',
    publishedAt: '2026-10-17T19:30:00+05:30',
    author: {
      name: 'Bsenexus Intelligence Team',
      role: 'Earnings & Results'
    },
    content: {
      introduction:
        'Saturday, October 17, 2026 was the busiest single day of this earnings season: HDFC Bank, Axis Bank and ICICI Bank — three of India’s four largest private lenders — all declared Q2 FY27 results the same day. It was also the first full quarterly read on the banking sector since the RBI restarted its rate-hike cycle on October 7, raising the repo rate to 5.50% and shifting its stance to “calibrated tightening.” The verdict: profits rose at all three, asset quality improved at all three, and margins compressed at all three as a flood of FCNR(B) deposits temporarily diluted net interest margins. ICICI was the only one of the three to beat the Street’s profit consensus; HDFC and Axis landed just below theirs.',
      sections: [
        {
          heading: 'The headline scorecard: actuals vs consensus',
          title: 'The headline scorecard: actuals vs consensus',
          content:
            'HDFC Bank: PAT Rs 19,510 crore, up 4.7% YoY (from Rs 18,641 crore) and up 2.8% QoQ — about 2.0% below the Rs 19,918 crore Business Standard consensus (October 9). NII Rs 34,620 crore, up 9.7% YoY. NIM 3.16% on total assets (3.32% on interest-earning assets), down 10 bps QoQ from 3.26%. ICICI Bank: PAT Rs 14,843 crore, up 20.1% YoY (from Rs 12,359 crore) — about 3.6% above the Rs 14,323 crore consensus, and also above the CNBC-TV18 poll of Rs 14,280 crore. NII Rs 25,339 crore, up 17.7% YoY. NIM 4.18%, down 18 bps QoQ from 4.36% (down 10 bps on the underlying 4.28% ex-tax-refund Q1 base). Axis Bank: PAT Rs 7,003 crore, up 38% YoY (from Rs 5,089 crore) — about 2.2% below the Rs 7,160 crore consensus. NII Rs 15,371 crore, up 12% YoY. NIM 3.36%, down 10 bps QoQ from 3.46% and down from 3.55% a year ago; excluding FCNR(B) deposits, NIM was 3.47%. Note on the HDFC figure: one wire item reports PAT at Rs 19,610 crore, but Rs 19,510 crore is carried by Business Standard, Business Today, LiveMint and TradingView/Moneycontrol coverage and is the headline this page uses.'
        },
        {
          heading: 'HDFC Bank: profit up 4.7%, margin down 10 bps, last quarter under Jagdishan',
          title: 'HDFC Bank: profit up 4.7%, margin down 10 bps, last quarter under Jagdishan',
          content:
            'NII rose 9.7% YoY to Rs 34,620 crore (from Rs 31,550 crore), while other income fell 3.6% YoY to Rs 13,830 crore as treasury trading gains dropped to Rs 780 crore from Rs 2,390 crore a year ago. Fees and commissions grew to Rs 9,690 crore (from Rs 8,840 crore). Provisions and contingencies were about Rs 3,570 crore with a total credit cost ratio of 0.44%. Asset quality improved: GNPA 1.11% (from 1.17% in Q1 and 1.24% a year ago), net NPA 0.37%. Gross advances grew 16.3% YoY to Rs 32.20 lakh crore; average advances under management rose 14.1% to Rs 31.87 lakh crore. End-period deposits grew 18.8% YoY to Rs 33.27 lakh crore; average deposits rose 16.8% to Rs 31.66 lakh crore; average CASA deposits grew 10.7% to Rs 9.71 lakh crore, with the period-end CASA ratio at 31.6% as time deposits (+22.8%) outgrew CASA (+10.8%). The quarter is the last earnings report under MD & CEO Sashidhar Jagdishan, whose tenure ends October 26; Anup Bagchi is set to take over. No dividend was announced alongside these results in the coverage reviewed.'
        },
        {
          heading: 'Axis Bank: profit up 38% as provisions halve, NIM 3.36%',
          title: 'Axis Bank: profit up 38% as provisions halve, NIM 3.36%',
          content:
            'Axis Bank’s 38% profit jump was powered by NII growth and a sharp fall in provisions: provisions and contingencies dropped 52% YoY to Rs 1,694 crore (including specific loan-loss provisions of Rs 1,564 crore), with annualised credit cost down to 0.45%. Operating profit rose 6% to Rs 11,083 crore and core operating profit 11% to Rs 10,998 crore. Other income slipped 1% to Rs 6,531 crore as trading income fell to Rs 85 crore from Rs 498 crore, while fee income rose 6% to Rs 6,381 crore. Asset quality improved: GNPA 1.16% (from 1.28% in Q1 and 1.46% a year ago), net NPA 0.35% (from 0.39% in Q1 and 0.44% a year ago), gross slippages down to Rs 4,762 crore (from Rs 5,566 crore in Q1). Advances grew 23% YoY and 9% QoQ to Rs 13.74 lakh crore — retail +16% to Rs 7.40 lakh crore (54% of net advances), SME +25%, corporate +34%. Deposits rose 21% YoY to Rs 14.52 lakh crore; term deposits +27%, current account +7%, savings +12%, with the CASA ratio at 36% (from 40% a year ago). FCNR(B) deposits stood at Rs 1.018 lakh crore. Business Standard reports the board also appointed former SEBI whole-time member Ananth Narayanan as an additional independent director effective October 19, 2026. For H1 FY27, PAT rose 30% YoY to Rs 14,117 crore.'
        },
        {
          heading: 'ICICI Bank: profit up 20.1%, core operating profit up 21.8%, NIM 4.18%',
          title: 'ICICI Bank: profit up 20.1%, core operating profit up 21.8%, NIM 4.18%',
          content:
            'ICICI delivered the strongest beat of the three. Core operating profit grew 21.8% YoY to Rs 20,805 crore; excluding dividend income from subsidiaries it rose 25.0% to Rs 20,342 crore. Fee income rose 20.1% to Rs 7,795 crore, non-interest income excluding treasury rose 12.5% to Rs 8,277 crore, and operating expenses grew a controlled 8.5% to Rs 12,811 crore. The bank booked a treasury loss of Rs 230 crore versus a Rs 220 crore gain a year ago. Provisions fell to Rs 851 crore (from Rs 914 crore), while the bank continued to hold contingency provisions of Rs 13,100 crore plus Rs 1,283 crore of additional standard-asset provisions on its agricultural priority-sector portfolio. Asset quality improved: GNPA 1.20% (from 1.38% in Q1 and 1.58% a year ago), net NPA 0.30% (from 0.35% in Q1 and 0.39% a year ago), gross NPA additions Rs 4,833 crore. Total advances grew 30% YoY to Rs 18.32 lakh crore (24.1% excluding loans against FCNR(B) deposits); domestic advances +22.8%, business banking +33.8%, domestic corporate +30.6%. Period-end deposits grew 27.1% YoY to Rs 20.50 lakh crore (17% excluding FCNR(B)); average deposits rose 21.2% to Rs 18.88 lakh crore with an average CASA ratio of 35.8%. On the earnings call, per NDTV Profit’s live blog, management said margins should start improving after Q3 (with a marginal decline likely in Q3), FCNR(B) deposits should be deployed over the next two quarters, it expects two more RBI repo hikes in the current cycle, and agri-portfolio provisions could reverse over the next two quarters subject to RBI approval. The board also approved seeking RBI approval for the continuation of Pradeep Kumar Sinha as Non-executive Part-time Chairperson until February 2029.'
        },
        {
          heading: 'The NIM question: FCNR(B) drag confirmed, RBI hike still to flow through',
          title: 'The NIM question: FCNR(B) drag confirmed, RBI hike still to flow through',
          content:
            'All three banks confirmed the margin story brokerages had flagged. HDFC’s NIM fell 10 bps QoQ (3.26% to 3.16% on total assets) — deeper than the 2-5 bps Nomura/JM Financial range. Axis fell 10 bps QoQ (3.46% to 3.36%), inside the expected 7-17 bps range, with 11 bps of the gap explained by FCNR(B) (3.47% ex-FCNR(B)). ICICI fell 18 bps QoQ on the headline (4.36% to 4.18%), at the top of the expected 10-18 bps range — but Q1’s 4.36% included an 8 bps benefit from interest on a tax refund, so the underlying move was 10 bps (4.28% to 4.18%). The pattern matches Nomura’s “dilution of a ratio and not of earnings” framing: NII still grew 9.7-17.7% YoY at all three. The other side of the story is still ahead — the RBI’s October 7 hike restarts the rate cycle, and floating-rate loans reprice with a lag, which should widen spreads over coming quarters. ICICI’s call guides to margin improvement after Q3; HDFC and Axis commentary on NIM trajectory, deposit-cost lag and repricing speed is the thing to track into Q3.',
          callout: {
            type: 'info',
            text: 'This page was prepared from the preview draft’s brokerage estimates and updated on the evening of October 17 with the reported numbers. Forecasts (HDFC PAT ~Rs 19,918 crore, ICICI ~Rs 14,323 crore, Axis ~Rs 7,160 crore; NIM compression ranges) are kept here only for comparison — they were estimates, not facts.'
          }
        }
      ],
      conclusion:
        'October 17 answered the quarter’s two questions. On profits: ICICI beat consensus with a 20.1% jump, while HDFC (+4.7%) and Axis (+38%) landed just below theirs — Axis’s miss flattered by nothing, since its 38% rise came off a weak year-ago base exactly as expected. On margins: FCNR(B) money squeezed NIMs by 10-18 bps across the three, roughly as brokerages predicted, while NII still grew at every bank and asset quality improved at every bank. With the RBI’s hike cycle restarted, the next checkpoint is Q3: whether repricing lifts margins back, as ICICI’s management guides, and whether deposit costs follow. Nothing here is investment advice.'
    },
    faq: [
      {
        question: 'When did HDFC Bank, Axis Bank and ICICI Bank declare Q2 FY27 results?',
        answer:
          'All three declared Q2 FY27 results (quarter ended September 30, 2026) on Saturday, October 17, 2026. HDFC Bank’s results landed in the early afternoon; Axis and ICICI followed the same day.'
      },
      {
        question: 'What were the Q2 FY27 profits of HDFC Bank, Axis Bank and ICICI Bank?',
        answer:
          'HDFC Bank: PAT Rs 19,510 crore, up 4.7% YoY. ICICI Bank: PAT Rs 14,843 crore, up 20.1% YoY. Axis Bank: PAT Rs 7,003 crore, up 38% YoY. Against the Business Standard consensus (October 9), ICICI beat (Rs 14,323 crore expected), while HDFC (Rs 19,918 crore expected) and Axis (Rs 7,160 crore expected) came in modestly below.'
      },
      {
        question: 'What happened to NIMs in Q2 FY27?',
        answer:
          'All three NIMs compressed sequentially: HDFC 3.26% to 3.16% on total assets (-10 bps), Axis 3.46% to 3.36% (-10 bps; 3.47% excluding FCNR(B) deposits), ICICI 4.36% to 4.18% (-18 bps headline, -10 bps against the 4.28% ex-tax-refund Q1 base). Brokerages attribute the drag mainly to FCNR(B) deposit mobilisation.'
      },
      {
        question: 'How did asset quality change in Q2 FY27?',
        answer:
          'Asset quality improved at all three banks. GNPA: HDFC 1.17% to 1.11%, Axis 1.28% to 1.16%, ICICI 1.38% to 1.20%. Net NPA: HDFC 0.37%, Axis 0.35%, ICICI 0.30%. Provisions fell sharply at Axis (-52% YoY to Rs 1,694 crore) and eased at ICICI (Rs 851 crore vs Rs 914 crore); HDFC provisions were about Rs 3,570 crore.'
      },
      {
        question: 'How fast did loans and deposits grow in Q2 FY27?',
        answer:
          'HDFC: advances +16.3% YoY to Rs 32.20 lakh crore, deposits +18.8% YoY to Rs 33.27 lakh crore, CASA ratio 31.6%. Axis: advances +23% YoY to Rs 13.74 lakh crore, deposits +21% YoY to Rs 14.52 lakh crore, CASA ratio 36%. ICICI: advances +30% YoY to Rs 18.32 lakh crore (24.1% ex-FCNR(B)), deposits +27.1% YoY to Rs 20.50 lakh crore (17% ex-FCNR(B)), average CASA ratio 35.8%.'
      },
      {
        question: 'Were any dividends or leadership changes announced with the Q2 FY27 results?',
        answer:
          'No dividend was announced alongside these results in the coverage reviewed. Leadership/governance items: HDFC’s was the last quarter under MD & CEO Sashidhar Jagdishan (tenure ends October 26), with Anup Bagchi set to take over; Axis appointed Ananth Narayanan as an additional independent director effective October 19, 2026 (per Business Standard); ICICI sought RBI approval to continue Pradeep Kumar Sinha as Non-executive Part-time Chairperson until February 2029.'
      },
      {
        question: 'How does the RBI’s October 7 rate hike affect the banks?',
        answer:
          'The RBI raised the repo rate 25 bps to 5.50% and shifted its stance to “calibrated tightening” — the first hike since February 2023. A restarting rate cycle lets floating-rate loans reprice with a lag, which should widen spreads over coming quarters; ICICI’s management guides to margin improvement after Q3, with FCNR(B) deposits deployed over the next two quarters.'
      }
    ]
  },
];

export const MARKET_GUIDES: ServerMarketGuide[] = [...KEYWORD_GUIDES, ...FALLBACK_MARKET_GUIDES];

export function getMarketGuides(): ServerMarketGuide[] {
  return MARKET_GUIDES;
}

export function getMarketGuideBySlug(slug: string): ServerMarketGuide | undefined {
  if (!slug) return undefined;
  const clean = slug.toLowerCase().trim();
  return MARKET_GUIDES.find(g => (g.slug && g.slug.toLowerCase() === clean) || (g.id && g.id.toLowerCase() === clean));
}

/** Only verified/public articles participate in search discovery. */
export function getIndexableMarketGuides(): ServerMarketGuide[] {
  return MARKET_GUIDES.filter(guide => guide.editorialStatus !== "verification-pending");
}
