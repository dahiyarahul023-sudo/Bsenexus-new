# Watchlist quota cooldown and hidden feed requests

- Scope: Supabase watchlist reads and the mounted React feed. Live ingestion, API TTL and the active browser poll interval are preserved.
- Observed behavior: repeated per-owner watchlist reads continue after a quota denial. The inactive feed is still mounted and its interval only gated on browser document visibility.
- After a confirmed Supabase HTTP 402, ordinary watchlist reads use existing in-memory or local fallback for 60 seconds per process. The shared global scan follows the same cooldown so failed inventory cannot fan out to the cloud. Durable write paths still need a fresh read and the existing compare-and-swap checks. Normal permitted reads retain their existing behavior.
- The terminal feed stops polling while its screen is hidden, cancels in-flight UI requests and immediately requests a fresh snapshot when shown again. The active screen keeps its 12-second interval. The server background poll and writes are independent.
- The map impact function and source references were reviewed, including the monitor, calendar, retention, watchlist website and durable connector flows. Updated maps are checked by GitHub CI. An outage/recovery test was added to the existing watchlist egress suite. Local execution was unavailable. Measured request and latency changes require post-deploy verification.
