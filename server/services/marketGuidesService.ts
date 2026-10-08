/**
 * Server-side fail-safe Market Guides provider.
 * Guarantees server.ts never crashes even if frontend files are modified or deleted.
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
    title: 'IPOs Listing on October 5\u20138, 2026: Listing Prices, Dates & Subscription',
    category: 'IPO',
    readTime: '7 min read',
    summary: 'Nineteen IPOs listed on the NSE and BSE from October 5\u20138, 2026 \u2014 six mainboard and four SME listings on October 5\u20137, plus seven SME and two mainboard debuts on October 8 led by Sollfege Smart Electronics\u2019 89.82% listing premium. Dates, price bands, listing prices and subscription levels, answered directly.',
    excerpt: 'Which IPOs listed from October 5\u20138, 2026, at what listing prices versus issue price, and how strongly were they subscribed? Direct answers for all nineteen listings.',
    date: '2026-10-08',
    publishedAt: '2026-10-05T03:30:00+05:30',
    author: {
      name: 'Bsenexus Intelligence Team',
      role: 'IPO & Primary Markets'
    },
    content: {
      introduction: 'Nineteen IPOs listed on the NSE and BSE from October 5\u20138, 2026. On Monday, October 5: Runwal Enterprises, Orient Cables (India), German Green Steel & Power, and AceVector \u2014 the parent company of Snapdeal. On Tuesday, October 6: SRIT India and Shah Investor\u2019s Home. On Wednesday, October 7, four SME IPOs debut: Vans Electroengineerings and Black Opal Consultants on the BSE SME platform, and Papadmalji Agro Foods and Green Asia Impex on NSE Emerge. Each listing\u2019s date, IPO size, price band and subscription level, answered directly below. On Thursday, October 8, nine more IPOs debuted: seven on the SME platforms \u2014 Omara Ventures India, Eventions, Dove Soft, SJP Ultrasonics, Sollfege Smart Electronics, Shree TNB Polymers and EverestIMS Technologies \u2014 and two on the mainboards: Vishal Nirmiti and Nityas Gems & Jewellery.',
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
        }
      ],
      conclusion: 'Thursday\u2019s nine listings are done: Sollfege Smart Electronics led the day, debuting at Rs 104.40 on BSE SME \u2014 89.82% above its Rs 55 issue price \u2014 followed by EverestIMS Technologies at Rs 126 (+48.24% over Rs 85) on 294x demand, SJP Ultrasonics at Rs 74.20 (+10.75% over Rs 67), Shree TNB Polymers at Rs 60 (+13.21% over Rs 53; opening figure from a single live quote at the time of writing), Omara Ventures India at Rs 319 (+2.57% over Rs 311), and Nityas Gems & Jewellery at Rs 82 on the BSE (+9.33% over Rs 75) and Rs 80 on the NSE (+6.7%). The day\u2019s weak debuts: Eventions slipped to Rs 111 (5.93% below its Rs 118 issue price), Dove Soft to Rs 110.30 (0.63% below Rs 111), and mainboard Vishal Nirmiti to Rs 215 (2.27% below Rs 220). Wednesday\u2019s four SME listings are done: Vans Electroengineerings debuted at Rs 224.20 on BSE SME \u2014 90% above its Rs 118 issue price on 628.73x demand \u2014 Black Opal Consultants listed at Rs 200 (+1.52% over Rs 197), Papadmalji Agro Foods at Rs 72.30 (+0.42% over Rs 72), and Green Asia Impex flat at Rs 89. Tuesday\u2019s two listings are done: SRIT India listed at Rs 148 on the NSE (+13.85% over Rs 130) and Rs 139.80 on the BSE (+7.54%), while Shah Investor\u2019s Home debuted at Rs 171 \u2014 a modest 2.4% premium over its Rs 167 issue price. Monday\u2019s four are in the books: Orient Cables delivered the week\u2019s standout debut (+65.44% to Rs 450), German Green Steel & Power listed modestly higher (+2.16% to Rs 142), Runwal Enterprises debuted flat at Rs 305, and AceVector slipped 11.5% to Rs 28.32. All ten companies will announce their Q2 FY27 results in October\u2013November 2026; track their filings, board meetings and results on Bsenexus as the earnings season unfolds.'
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
    title: 'TCS Q2 FY27 Results on October 8, 2026: Date, Preview & Analyst Expectations',
    category: 'Earnings',
    readTime: '4 min read',
    summary:
      'Tata Consultancy Services reports Q2 FY27 results on Thursday, October 8, 2026, after market close. Analysts expect a modest quarter: PAT around Rs 13,700-13,785 crore (up ~3% QoQ), revenue near Rs 73,000 crore, and margins improving ~40 bps as the wage-hike cycle concludes. The board will also consider a second interim dividend.',
    excerpt:
      'When does TCS declare Q2 FY27 results, what are analysts expecting on revenue, profit and margins, and is there a dividend? Direct answers for the October 8 results.',
    date: '2026-10-06',
    publishedAt: '2026-10-06T09:30:00+05:30',
    author: {
      name: 'Bsenexus Intelligence Team',
      role: 'Earnings & Results'
    },
    content: {
      introduction:
        'TCS kicks off the Q2 FY27 earnings season on Thursday, October 8, 2026, with results expected after market close. Brokerages expect a soft but stable quarter: roughly 0.5-0.6% sequential constant-currency revenue growth, a PAT of about Rs 13,700-13,785 crore (up ~3% QoQ), and margins ticking up as the wage-hike cycle concludes. Deal wins of $8-10 billion and commentary on demand recovery are the numbers to watch.',
      sections: [
        {
          heading: 'When does TCS announce Q2 FY27 results?',
          title: 'When does TCS announce Q2 FY27 results?',
          content:
            'TCS will announce its Q2 FY27 (quarter ended September 30, 2026) results on Thursday, October 8, 2026, after market hours. The board of directors meets the same day to consider the financial results and a proposal for a second interim dividend. If declared, the dividend will be paid to shareholders whose names appear in the register or depository records as on Wednesday, October 14, 2026, the record date fixed by the company.'
        },
        {
          heading: 'What are analysts expecting from TCS Q2?',
          title: 'What are analysts expecting from TCS Q2?',
          content:
            'Consensus estimates point to a modest quarter. PAT is seen at about Rs 13,785 crore, up 3.27% QoQ from Rs 13,349 crore in Q1; JM Financial expects Rs 13,702.5 crore. Revenue in rupee terms is seen at Rs 73,007 crore, up 1.01% QoQ from Rs 72,275 crore, while dollar revenue is expected up 0.5% QoQ to $7,662 million. On a constant-currency basis, brokerages expect 0.5-0.6% sequential growth - JM Financial and Nuvama are in that range. EBIT margin is expected to improve about 43 basis points to 24.39%, from 23.96% in Q1, helped by the conclusion of the wage-hike cycle.'
        },
        {
          heading: 'Key things to watch on October 8',
          title: 'Key things to watch on October 8',
          content:
            'First, deal wins: JM Financial expects total contract value of $8-10 billion - strong bookings matter more than ever because Kotak warns AI-driven pricing pressure means big deals may not translate into immediate revenue. Second, margins and the wage-hike reversal. Third, management commentary on demand in banking and developed markets, where Nuvama notes September demand weakened amid geopolitical uncertainty. Fourth, the BSNL phase-2 ramp-down and the update on large deals (MHP, Metro). And fifth, any comment on the H-1B visa fee hike and its cost impact.'
        },
        {
          heading: 'The Best Buy India GCC deal and the AI angle',
          title: 'The Best Buy India GCC deal and the AI angle',
          content:
            'TCS acquired Best Buy\u2019s India global capability centre in a multi-year deal and will convert it into an AI-native hub, redesigning workflows and building AI-driven retail applications. Morgan Stanley kept an equal-weight rating with a Rs 2,160 price target, calling the small deal strategically positive - better revenue visibility should outweigh margin dilution. The broader industry backdrop is cautious: JM Financial says large Indian IT is entering a fourth consecutive year of subdued growth, with AI-led productivity pressure and no meaningful revival in client budgets.',
          callout: {
            type: 'info',
            text: 'This page is a preview built on analyst forecasts, not on reported numbers. Bsenexus will decode the actual Q2 filing the same day it hits the exchanges - revenue, PAT, margins and dividend, in plain language - under the standing no-asking results-day playbook.'
          }
        }
      ],
      conclusion:
        'Expectations for TCS Q2 are modest - around 0.5% sequential growth and a small margin uptick - so the market reaction will hinge on commentary, not just numbers: deal conversions, demand visibility for the next two quarters, and how the company frames AI-led pricing pressure. Actual results land on October 8 after market close; this guide will be updated with the reported numbers the same evening. None of the above is investment advice - analyst forecasts are routinely revised, and the only numbers that matter are the ones TCS files.'
    },
    faq: [
      {
        question: 'When will TCS declare Q2 FY27 results?',
        answer:
          'TCS will declare its Q2 FY27 results (quarter ended September 30, 2026) on Thursday, October 8, 2026, after market hours. The board meets the same day.'
      },
      {
        question: 'What is the expected TCS Q2 FY27 profit (PAT)?',
        answer:
          'Analyst consensus puts TCS Q2 FY27 PAT at about Rs 13,785 crore, up roughly 3.3% quarter-on-quarter from Rs 13,349 crore in Q1. JM Financial expects Rs 13,702.5 crore.'
      },
      {
        question: 'Is TCS declaring a dividend with Q2 results?',
        answer:
          'The TCS board will consider a proposal for a second interim dividend on October 8, 2026. If declared, the record date is Wednesday, October 14, 2026. The amount, if any, will be known only after the board meeting.'
      },
      {
        question: 'What is TCS\u2019s Best Buy GCC deal?',
        answer:
          'TCS acquired Best Buy\u2019s India global capability centre in a multi-year deal and plans to convert it into an AI-native hub for redesigned workflows and AI-driven retail applications. Morgan Stanley rates TCS equal-weight with a Rs 2,160 target, calling the deal strategically positive.'
      },
      {
        question: 'What is the revenue growth expectation for TCS Q2 FY27?',
        answer:
          'Brokerages expect about 0.5-0.6% sequential constant-currency revenue growth - JM Financial expects ~0.5% and Nuvama ~0.6%. In rupee terms, revenue is seen near Rs 73,007 crore, up about 1% quarter-on-quarter.'
      }
    ]
  }
];

export const MARKET_GUIDES: ServerMarketGuide[] = FALLBACK_MARKET_GUIDES;

export function getMarketGuides(): ServerMarketGuide[] {
  return MARKET_GUIDES;
}

export function getMarketGuideBySlug(slug: string): ServerMarketGuide | undefined {
  if (!slug) return undefined;
  const clean = slug.toLowerCase().trim();
  return MARKET_GUIDES.find(g => (g.slug && g.slug.toLowerCase() === clean) || (g.id && g.id.toLowerCase() === clean));
}
