import { EXCHANGE_COMPANIES } from './exchangeCompanies';

export interface ListedCompany {
  symbol: string;
  scripCode: string;
  name: string;
  sector: string;
  category: string;
  description: string;
  marketCapRank: number;
  listingLabel?: string;
}

export const DIRECTORY_COMPANIES: ListedCompany[] = [
  ...EXCHANGE_COMPANIES.map(company => ({ ...company, marketCapRank: 0 })),
  {
    symbol: "RELIANCE",
    scripCode: "500325",
    name: "Reliance Industries Ltd",
    sector: "Energy & Petrochemicals / Conglomerate",
    category: "Mega Cap Leader",
    description: "India's largest listed conglomerate spanning energy, petrochemicals, retail, telecommunications (Jio), and renewable green energy.",
    marketCapRank: 1
  },
  {
    symbol: "TCS",
    scripCode: "532540",
    name: "Tata Consultancy Services Ltd",
    sector: "IT Services & Software",
    category: "Tech Heavyweight",
    description: "Global leader in IT services, digital transformation consulting, cognitive automation, and enterprise cloud infrastructure solutions.",
    marketCapRank: 2
  },
  {
    symbol: "HDFCBANK",
    scripCode: "500180",
    name: "HDFC Bank Ltd",
    sector: "Private Sector Banking & Finance",
    category: "Banking Giant",
    description: "India's largest private sector bank offering comprehensive retail, commercial, corporate banking, and digital transaction services.",
    marketCapRank: 3
  },
  {
    symbol: "INFY",
    scripCode: "500209",
    name: "Infosys Ltd",
    sector: "IT Services & Consulting",
    category: "Tech Heavyweight",
    description: "Pioneer in global information technology services, next-generation cloud migration, enterprise AI engineering, and digital workflows.",
    marketCapRank: 4
  },
  {
    symbol: "ICICIBANK",
    scripCode: "532174",
    name: "ICICI Bank Ltd",
    sector: "Private Sector Banking & Finance",
    category: "Banking Giant",
    description: "Premier Indian multinational banking and financial services institution providing retail mortgages, wealth management, and corporate credit.",
    marketCapRank: 5
  },
  {
    symbol: "SBIN",
    scripCode: "500112",
    name: "State Bank of India",
    sector: "Public Sector Banking",
    category: "PSU Banking Leader",
    description: "India's flagship Fortune 500 public sector bank commanding over 22% domestic deposit market share with widespread global presence.",
    marketCapRank: 6
  },
  {
    symbol: "BHARTIARTL",
    scripCode: "532454",
    name: "Bharti Airtel Ltd",
    sector: "Telecommunications & Digital Services",
    category: "Telecom Leader",
    description: "Leading global telecommunications corporation operating across South Asia and Africa with nationwide 5G, enterprise IoT, and cloud networks.",
    marketCapRank: 7
  },
  {
    symbol: "ITC",
    scripCode: "500875",
    name: "ITC Ltd",
    sector: "Diversified FMCG & Cigarettes",
    category: "FMCG Heavyweight",
    description: "Diversified conglomerate with dominant leadership across branded packaged foods, personal care, luxury hotels, paperboards, and agri-business.",
    marketCapRank: 8
  },
  {
    symbol: "KOTAKBANK",
    scripCode: "500247",
    name: "Kotak Mahindra Bank Ltd",
    sector: "Private Sector Banking & Finance",
    category: "Banking & Wealth",
    description: "Prominent Indian banking and financial conglomerate spanning commercial lending, equity brokerage, insurance, and alternative asset management.",
    marketCapRank: 9
  },
  {
    symbol: "LT",
    scripCode: "500510",
    name: "Larsen & Toubro Ltd",
    sector: "Infrastructure & Heavy Engineering",
    category: "Capex & Infra Titan",
    description: "India's premier multinational engaged in EPC projects, hi-tech manufacturing, defense engineering, power grids, and infrastructure development.",
    marketCapRank: 10
  },
  {
    symbol: "AXISBANK",
    scripCode: "532215",
    name: "Axis Bank Ltd",
    sector: "Private Sector Banking & Finance",
    category: "Banking Giant",
    description: "Third-largest private sector bank in India delivering comprehensive corporate lending, digital retail payments, and treasury solutions.",
    marketCapRank: 11
  },
  {
    symbol: "MARUTI",
    scripCode: "532500",
    name: "Maruti Suzuki India Ltd",
    sector: "Automobile Manufacturing",
    category: "Auto Champion",
    description: "India's undisputed passenger vehicle manufacturer controlling over 40% domestic market share with passenger cars, SUVs, and hybrid mobility.",
    marketCapRank: 12
  },
  {
    symbol: "TITAN",
    scripCode: "500114",
    name: "Titan Company Ltd",
    sector: "Consumer Goods & Jewellery",
    category: "Consumer Discretionary",
    description: "Tata Group luxury retail powerhouse dominating organized jewellery (Tanishq, Mia, CaratLane), watches, precision eyewear, and lifestyle fragrances.",
    marketCapRank: 13
  },
  {
    symbol: "ASIANPAINT",
    scripCode: "500820",
    name: "Asian Paints Ltd",
    sector: "Paints & Home Improvement",
    category: "Consumer & Home Decor",
    description: "India's largest decorative and industrial paint manufacturer with extensive international presence and integrated home decor solutions.",
    marketCapRank: 14
  },
  {
    symbol: "HCLTECH",
    scripCode: "532281",
    name: "HCL Technologies Ltd",
    sector: "IT Services & Software Products",
    category: "Tech Heavyweight",
    description: "Global technology enterprise delivering digital engineering, hybrid cloud platforms, cybersecurity, and enterprise software products.",
    marketCapRank: 15
  },
  {
    symbol: "SUNPHARMA",
    scripCode: "524715",
    name: "Sun Pharmaceutical Industries Ltd",
    sector: "Pharmaceuticals & Healthcare",
    category: "Pharma Champion",
    description: "India's largest pharmaceutical corporation and top global specialty generic manufacturer with strong market share in dermatology and ophthalmology.",
    marketCapRank: 16
  },
  {
    symbol: "TATAMOTORS",
    scripCode: "500570",
    name: "Tata Motors Ltd",
    sector: "Automotive & Commercial Vehicles",
    category: "Mobility & EV Pioneer",
    description: "Multinational automotive corporation leading Indian electric passenger mobility (EVs), commercial freight trucks, and British luxury subsidiary Jaguar Land Rover.",
    marketCapRank: 17
  },
  {
    symbol: "TATASTEEL",
    scripCode: "500470",
    name: "Tata Steel Ltd",
    sector: "Metals & Mining",
    category: "Metals Leader",
    description: "Top global integrated steel manufacturing corporation with crude steel capacity exceeding 35 MTPA across high-efficiency Indian and European mills.",
    marketCapRank: 18
  },
  {
    symbol: "WIPRO",
    scripCode: "507685",
    name: "Wipro Ltd",
    sector: "IT Services & Consulting",
    category: "IT Major",
    description: "Global information technology, enterprise cloud consulting, and business process services company driving AI and digital enterprise workflows.",
    marketCapRank: 19
  },
  {
    symbol: "ULTRACEMCO",
    scripCode: "532538",
    name: "UltraTech Cement Ltd",
    sector: "Cement & Building Materials",
    category: "Materials Champion",
    description: "The flagship cement company of Aditya Birla Group and India's largest manufacturer of grey cement, ready-mix concrete, and white cement.",
    marketCapRank: 20
  },
  {
    symbol: "NTPC",
    scripCode: "532555",
    name: "NTPC Ltd",
    sector: "Power Generation & Utilities",
    category: "Energy & Utilities",
    description: "India's largest integrated energy conglomerate generating over 24% of national electricity with rapid expansion into solar, wind, and green hydrogen.",
    marketCapRank: 21
  },
  {
    symbol: "POWERGRID",
    scripCode: "532898",
    name: "Power Grid Corporation of India Ltd",
    sector: "Power Transmission",
    category: "Infrastructure Monopoly",
    description: "Central Transmission Utility of India wheeling approximately 85% of total domestic inter-regional electricity through high-voltage transmission grids.",
    marketCapRank: 22
  },
  {
    symbol: "ONGC",
    scripCode: "500312",
    name: "Oil & Natural Gas Corporation Ltd",
    sector: "Oil & Gas Exploration",
    category: "Energy & Resources",
    description: "India's premier public sector enterprise contributing around 71% to domestic crude oil production and 84% of natural gas output.",
    marketCapRank: 23
  },
  {
    symbol: "COALINDIA",
    scripCode: "533278",
    name: "Coal India Ltd",
    sector: "Mining & Energy Resources",
    category: "Energy Security Titan",
    description: "The world's largest coal-producing corporation supplying key fuel feedstock to Indian thermal power generation and heavy metallurgical plants.",
    marketCapRank: 24
  },
  {
    symbol: "BAJFINANCE",
    scripCode: "500034",
    name: "Bajaj Finance Ltd",
    sector: "Non-Banking Financials (NBFC)",
    category: "Consumer Finance Star",
    description: "India's largest diversified non-banking financial company specializing in consumer durable financing, MSME lending, wealth management, and credit cards.",
    marketCapRank: 25
  },
  {
    symbol: "TRENT",
    scripCode: "500251",
    name: "Trent Ltd",
    sector: "Retail & Fashion Apparel",
    category: "Fast Fashion Powerhouse",
    description: "Fast-growing Tata Group retail powerhouse operating leading lifestyle and value apparel chains Westside, Zudio, and Star Bazaar food hypermarkets.",
    marketCapRank: 26
  },
  {
    symbol: 'NXST', scripCode: '543913', name: 'Nexus Select Trust',
    sector: 'Real Estate / Retail REIT', category: 'Listed REIT',
    description: 'A listed real estate investment trust with a portfolio of retail consumption centres in India. Units trade as NXST on NSE and BSE under security code 543913.',
    marketCapRank: 0
  }
];


export function directoryDescription(companies: readonly ListedCompany[] = DIRECTORY_COMPANIES): string {
  return `Explore ${companies.length} curated company, REIT and exchange operator profiles on BSE Nexus, including BSE Limited, NSE Limited and Nexus Select Trust. Find filings, earnings information and official investor sources.`;
}
export function directoryBadge(companies: readonly ListedCompany[] = DIRECTORY_COMPANIES): string {
  return `${companies.length} CURATED PROFILES`;
}
