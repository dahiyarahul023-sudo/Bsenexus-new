# Impact Radar operations

For You shows at most two Impact Radar cards plus See more, followed by the original three-card Market News preview. Ordinary news remains separate and All news opens NewsPortal. See more opens a full native modal Radar dashboard; a card opens its brief immediately at the top of that window. Track event saves a user's matter for later visits and across devices; it does not subscribe that user to Telegram, push or paid alerts.

The public contract in `src/shared/impactRadar.ts` deliberately has no sentiment, forecast, target or probability fields. Admission validates bounded text and known shapes, and public/storage projections discard extra properties. The text check is a conservative editorial guard, not a legal or investment-advice classification system. Source-backed publication still needs editorial judgment.

## Data and authority

`impact_radar_events` contains the current event and optional explicit date. `impact_radar_updates` stores immutable source updates. `impact_radar_follows` stores `(verified Firebase UID, event ID)` pairs. These are server-only tables: RLS is enabled, browser grants are revoked, and only service_role can use them. Server routes verify the UID independently; clients cannot choose it.

`publish_impact_radar_records` atomically publishes event metadata and source evidence. Replays are idempotent, older source batches cannot rewind a case, and a source update ID cannot move between cases or be rewritten. Editorial facts and dates survive later automated intake; new evidence still joins the timeline. A material correction must have a new update ID.

## Intake and grouping

Visible Home requests the radar at most every 60 seconds per component. Server intake is single-flight per process with a 60-second check window, bounded source records and database timeouts. Existing shared RSS fetching/cache is reused; no additional poller, cron schedule, Telegram dispatch or AI request is added. Filing intake reads the existing announcement cache and requires a valid BSE/NSE attachment, known Indian scrip and genuine exchange timestamp. Source-reported news is visibly distinguished from company disclosures and original official sources.

An exact case/appeal/petition reference including its year is grouped only within a recognized national authority and the same Indian company. Delhi High Court is recognized explicitly; generic High Court/NCLT references lack jurisdiction/bench identity and are not automatically merged. Otherwise canonical article/filing URLs identify separate source reports. Similar headlines or the same company alone do not establish a shared legal matter. The intake never guesses case identity, final judgments, business exposure, price effects or historical analogues. Explicit full-year next-hearing dates in a source can be recorded with source evidence; news dates remain unconfirmed, and tentative language never produces a confirmed date. Event dates require an explicit authority/order date in an official source or reviewed publication. Unknown next dates never enter upcoming filters. Today also includes reports published today. Earlier source updates stay in the immutable timeline, and detail separately queries the earliest recorded announcement even beyond the latest-50 timeline limit. Related same-company/authority reports are marked as unlinked, not silently merged.

For a reviewed multi-day matter use `POST /api/impact-radar/admin/publish` with `{event, update}` and an authenticated admin session. Reuse its canonical `event.id`; every later source has its own `update.id` and matching `update.eventId`. The full validated event fields are defined in the shared TypeScript interface. `scheduledDate` is `YYYY-MM-DD` in IST without an invented hearing time; `scheduleConfirmed` must describe source evidence. Use `scheduled` before the event, `active` for a confirmed ongoing matter, `monitoring` while following reported developments and `closed` only when supported. A scheduled date passing never changes status automatically.

## API and client recovery

- `GET /api/impact-radar`: latest 200 recently updated records, including closed records for Past, checked time and source-intake status. It is not a real-time quote feed or an exhaustive archive.
- `GET /api/impact-radar/:id`: event, latest 50 immutable source updates, earliest recorded update and up to eight related company/authority reports.
- `GET /api/impact-radar/:id/movement`: separate observed daily movement from NSE final CM UDiFF bhavcopies; no price forecast.
- `GET /api/impact-radar/following`: current user's most recent 500 followed records, including closed cases.
- `PUT /api/impact-radar/:id/follow`: `{followed: boolean}`; verified ownership, idempotent durable write, no local-only success.

All responses are private/no-store. Background arrivals queue for Show updates; old account and cancelled reads cannot replace current state. Writes update the tracking button/count/filter only after confirmation. A timeout can have an unknown server outcome, so refresh/retry reconciles the same idempotent desired state. Tracking-list read failure does not manufacture an empty confirmed list. Offline or delayed sources keep their timestamps and display recovery copy.

## Release and verification

Apply `supabase/migrations/20261016180236_impact_radar.sql` before serving the new application. Existing `SUPABASE_URL` and server-only service-role configuration are reused. Run the radar regression files, typecheck/build and map checks; test mobile/tablet/desktop themes, keyboard/focus, reduced motion, source failures and account switching with an authorized browser environment.

No speculative case or unverified research example is seeded. The first feed fills from available source data and reviewed publications. Repository delivery, SQL installation and application hosting deployment are separate release states. To roll back presentation, retain the ordinary HomeMarketNews preview and revert the Radar follow-up UI; retain the durable event/follow tables and evidence.

## Dashboard and date discovery

All events and Watchlist Radar are independent scopes; Tracking means followed event IDs, not stock watchlist membership. Watchlists are read by HomeForYou using the verified current session; read failures have an explicit retry and never become a confirmed empty watchlist. The full view starts with 12 cards and loads 12 more from the bounded server feed. Live Radar contains active matters or monitoring updates today, not a presumed live court hearing. Colours are accompanied by text: live/today teal, upcoming amber, past slate, unknown scheduled dates violet. The brand sweep and status pulse honour reduced motion.

Source publication, sourced event date, next date and earliest recorded announcement are separate fields. Official court case-status/cause-list or regulator links are verification routes, not a claim that this app continuously scrapes every court. The ordinary source intake runs on visible feed requests; dates that require PDF or interactive court lookup still need reviewed source publication. Missing dates remain explicit.

## Observed prices

The price endpoint constructs only a fixed HTTPS NSE archive URL for validated dates. It streams at most 6 MB, validates the single expected ZIP entry, bounds decompression to 25 MB, and validates report date/source/segment/instrument/series. Only positive-volume EQ/BE stock records with positive finite close and previous close are admitted. Per-date cache holds at most 32 reports; duplicate requests coalesce, at most four upstream downloads run, and requests time out after five seconds. No provider credentials, AI estimates, Yahoo quotes or inferred headline percentages are used.

The brief shows up to three available daily sessions within eight calendar days for the first three named companies, anchored to an explicit sourced event date or otherwise the clearly labelled report date. Final daily reports are requested only after 4 pm IST. An after-3:30-pm publication is marked after-close; that day’s return cannot be attributed to the later report. Return is `(close / exchange previous close - 1) * 100`. Missing/blocked reports are unavailable, never 0%; gaps are not assumed holidays. Prices are INR, corporate actions may affect comparisons, and observed movement does not prove causation. NSE coverage may omit BSE-only securities; a verified BSE historical-price adapter is not included. This is a stated coverage limitation, not a fictional fallback.

No schema migration is needed for this follow-up: source/date fields use the existing validated JSON projection, and prices are read separately. Existing RLS, grants, immutable updates and verified UID follow writes are unchanged.

A next hearing being scheduled does not hide historical prices for an already sourced past order/event date. Upcoming-only matters still have no expected move or event reaction. Verified unchanged closes display 0%; missing records remain unavailable.
