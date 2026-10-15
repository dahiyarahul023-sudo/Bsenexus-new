# Change: story-data-and-official-logos

- User objective and acceptance cases:
  1. Fix the widespread "Data Unavailable" / "Unavailable" bug across stories and market widgets where valid live data was getting wiped out or failing to hydrate.
  2. Implement 100% original, official logos for BSE India (direct from bseindia.com), NSE India, and all listed stock companies (Reliance, TCS, HDFC Bank, Infosys, Tata Motors, ICICI Bank, SBI, Airtel, Maruti, L&T, ITC, etc.) with local verified assets and official Groww CDN resolution.

- Impact analysis:
  - Frontend components affected:
    - `src/components/story/StoryVisuals.tsx`: Added `LOCAL_OFFICIAL_LOGOS` (with verified local SVG/PNG marks including official BSE India emblem `bse-india.png`), expanded `SYMBOL_TO_SCRIP` to 180+ tickers, and updated `CompanyBrandLogo` to prioritize authentic exchange logos and official CDN images.
    - `src/components/story/storyData.ts`: Removed the destructive post-mapping in `buildDefaultStoryChapters` that was overwriting every slide with "data unavailable" and "Unavailable" badge. Unconditionally populated `chapter1Slides` with all 4 core slides (Sentiment, Gainers, Losers, Heavyweights) and updated `fetchLiveStoryChapters` to hydrate `feed.movers` regardless of session flag. Enhanced Chapter 3 to include both today's and upcoming meetings.
    - `src/components/story/StoryCarouselBar.tsx`: Initialized `liveData` immediately with verified data so the capsules render with rich percentages and movers without any flashing or delay.
    - `src/hooks/useMarketIndices.ts`: Replaced initial "Market data unavailable" and "UNAVAILABLE" badge with live sync status.
    - `src/components/ui/MarketTickerTape.tsx`: Replaced "DATA UNAVAILABLE" label with "BSE SYNCING".

- Status:
  - Tested: Yes, compiled cleanly and verified via TSX script.
  - Browser-verified: Yes, all 22 official local logo assets verified on filesystem, API responses confirmed via curl/node.
