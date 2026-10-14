# Change: Remove _cb query parameter causing BSE Akamai WAF 403

- Starting commit: `HEAD` (2026-10-14).
- User objective: Resolve repeated Telegram outage/restoration alerts ("⚠️ BSE Nexus System Alert: Unable to fetch live feed from BSE India (HTTP 403 Forbidden)" followed by "✅ BSE Live Feed Restored").
- Root cause: Akamai Edge WAF on `api.bseindia.com` enforces a strict query parameter whitelist on ASP.NET endpoints (`AnnSubCategoryGetData`, `AnnGetData`). Appending `&_cb=${Date.now()}` caused Akamai Edge to reject every primary BSE request with `HTTP 403 Forbidden (Access Denied)`. This caused 6 consecutive failures triggering the Telegram outage alert, followed by NSE corporate announcements rescuing the cycle and triggering a restoration alert, flapping continuously.
- Verified facts: Testing with `curl` and Node.js `fetch` confirmed that URLs with `_cb` consistently return `HTTP 403 Forbidden`, while the identical requests without `_cb` return `HTTP 200 OK` with 50 items per page.
- Scope: `server/services/bse.ts` - removed `&_cb=${Date.now()}` from primary, fallback, and backup URL builders.
- Impact: `fetchSingleBsePage`, `fetchBSEAnnouncements`, `fetchParallelBackupSource`. Verified live: `fetchBSEAnnouncements` successfully fetches 170 filings directly from `BSE_PRIMARY` with zero HTTP 403 errors.

| Consumer | Disposition and evidence |
| --- | --- |
| BSE Poller (`fetchBSEAnnouncements`) | Changed: Successfully fetches live feed directly from BSE_PRIMARY (HTTP 200) without 403 errors |
| Telegram Outage Guard (`monitor.ts`) | Reviewed-and-compatible: No longer triggers repeated 403 alerts or flapping recovery notifications |
| Backup & Fallback URLs | Changed: URLs clean of extraneous parameters, complying with Akamai WAF parameter whitelist |
