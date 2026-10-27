# Overnight ADR contract

Home, the shared Market pulse Story, company intelligence and optional watchlist inbox alerts use one server snapshot from `/api/market/adr` / `getAdrSnapshot`. This is a bounded market-context feature; ordinary ADR price moves do not create Impact Radar events. Company news retains its seven-screen/two-per-company budget.

## Identity and source

`src/shared/adr.ts::ADR_COMPANIES` is a reviewed registry of five Indian-listed issuers and their active NYSE ADR symbols: Infosys/INFY, HDFC Bank/HDB, ICICI Bank/IBN, Wipro/WIT and Dr. Reddy's/RDY. Exact BSE codes and issuer/SEC listing evidence are stored with the registry. It does not expand ingestion, invent ADR coverage for every stock, include delisted Tata Motors receipts, or grant a company identity to an aggregate.

Use the already-installed Yahoo Finance v4 chart adapter. UI attribution is Yahoo Finance; this is not an NSE/BSE ADR quote or an exchange-authorized redistribution claim. Issuer/SEC pages validate identity, not current prices. Provider availability and any redistribution agreement remain operational responsibilities; no account/key or paid package is added by this change.

Only positive finite USD regular-session daily closes with the expected US symbol, NYSE venue and New York timezone are admitted. Compute US close-to-previous-US-close change; never substitute after-hours, pre-market, intraday last price or Indian equity change. `sessionDate`, `previousSessionDate`, `sessionCloseAt` and `checkedAt` are separate facts. Convert the fallback 16:00 close using the date's New York DST offset; respect a provider-confirmed early close. A 15-minute completion grace excludes bars around the closing boundary. Current US intraday bars cannot replace the last completed session.

Rows older than seven calendar days are omitted, older than 96 hours lose highlight/alert eligibility. Friday sessions can remain the most recent on Monday. Source dates remain visible across US holidays. Split-containing comparisons are marked and excluded from alerts; thin sessions below 10,000 ADR units do not trigger alerts. Unknown/malformed prices are unavailable, never zero. No inferred ADR/Indian parity, FX estimate, expected opening or causal explanation is supplied.

## Snapshot, cache and failures

The provider has one in-flight batch per server process and a five-minute successful-attempt TTL for Home, Stories and workers. Five symbols are read concurrently on the configured query1 host; SDK HTTP calls have eight-second limits within a ten-second chart signal. Failure retries start at one minute and back off to fifteen minutes. Partial failures retain each missing valid quote; an older source session cannot replace or reconfirm a newer saved session. Failure retains the original check time and sets refreshFailed, removing prominence and Story/alert eligibility. Missing registry coverage remains explicit. The endpoint returns 503/no-store when no usable rows exist and a public 30-second cache only for usable public data.

Server restart hydrates validated public evidence from service-only settings keys market:adr:v1:<session>:<symbol> (bounded latest forty rows, immutable insert-once session keys); the global bot settings key is never read or changed by this DAO. Existing RLS has no client policy. Two-second persistence deadlines keep reads bounded; failure is safely logged and does not discard available in-memory evidence. Local JSON is a development/unconfigured fallback, not claimed cloud durability. This adds no schema or access policy. Expired or malformed rows are rejected again on read. Empty provider responses never overwrite saved usable rows.

The browser coalesces public reads for a minute and retains a public localStorage snapshot across reloads. Restored data is always unconfirmed until the API succeeds; denied/corrupt storage cannot break the request. Failed requests preserve only validated, unexpired saved quotes with refreshFailed. Visible Home/company views refresh, hidden work pauses, and disposed effect epochs cannot update old views. A snapshot checked more than ten minutes ago displays saved/unconfirmed status, loses prominence and is omitted from ADR Stories/alerts. Provider outages remain real: an empty first-ever cache cannot manufacture a price.

## Presentation

Home reuses `heliosCard`, existing ActionButton and the global Comfortable/Compact/Dense setting. Show three rows initially; View all expands only to registry coverage. Real company buttons call the existing Company Intelligence owner, while separate source links open the quote. Existing light/dark surfaces, semantic positive/negative colours, readable signs/labels, focus and reduced-motion feedback apply. A large move promotes the existing card; it does not stack another banner or repeat an illustration.

Displayed absolute moves of 4.00–4.99% use Large US move; 5.00% or greater use Sharp US move. Thresholds use the same two-decimal rounding as UI copy. These are product thresholds, not a statistical claim. Company intelligence shows a compact source/session strip only for a registry identity. One list-layout Story (maximum three companies) is inserted into the existing Market pulse chapter; it uses the same values and exact company actions, with a neutral aggregate subject. No separate ADR chapter or decorative graph is added.

## Watchlist alerts

`Morning ADR alerts` in the existing Alert Rules panel is an explicit opt-in (`notificationPreferences.adrAlertsEnabled`), default off. The server accepts this boolean through its existing whitelist and existing confirmed preference-save owner. User/account changes invalidate pending preference feedback. Inbox mute, per-priority stock mute and current active-list exact identity are authoritative; a matching text substring never grants membership.

The existing secret-protected announcement cron awaits ADR maintenance in `afterPoll`, alongside its other maintenance; the existing 60-second watchdog also invokes it. There is no new timer or Scheduler. The worker does no user/quote work outside 08:00–09:15 IST weekdays and serializes local passes. Up to eight eligible owners are rotated per pass, four concurrently; each owner gets fresh durable profile/watchlist reads. Failed reads cannot authorize cached local membership in production. Failed recipient checks/saves log a safe count, without user payloads.

Only the first weekday morning after the actual US close qualifies. An early close after 08:00 IST belongs to the following weekday morning; a Friday close belongs to Monday. A US holiday cannot relabel an older close as a new Tuesday alert. This weekday gate is not an Indian exchange holiday-calendar service. Skip partial, unconfirmed, split and thin-volume snapshots. Select matching notable ADRs and create one private digest per owner/US session. Clicking its existing inbox action opens the leading exact company.

`notificationDao::addNotificationOnce` uses the existing notifications primary key with `ignoreDuplicates: true` and returned-ID confirmation. Concurrent workers/process restarts cannot replace the first row, read flag, recipient or arrival timestamp. Inbox arrival time is distinct from source close time in metadata; clearing an inbox before the morning does not discard a genuinely new arrival, and later duplicate attempts cannot resurrect a cleared notification. Production store failure is an error, not a local delivery success. Existing notification table/grants suffice; no migration is required.

This release uses private in-app inbox alerts. Existing browser push is a device subscription/broadcast path without account identity binding; it must not broadcast a personal watchlist digest. Telegram and browser push delivery are not added or implied by the ADR preference.

## Maintenance and release evidence

Keep the `overnight-adr` domain, related story/alert domains, generated map and `changes/overnight-adr.md` current. Tests cover source/session math, DST/open/early-close, stale/partial/outage, render/value agreement, exact membership/mute/opt-in, worker ownership, HTTP errors and real isolated Postgres conflict semantics across concurrent/restarted DAO callers. Passing source/render/build checks do not establish phone rendering, live notification delivery, production deployment or provider agreements. Rollback is the code change; no database rollback is needed and existing inbox events remain historical facts.
