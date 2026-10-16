# Impact Radar operations

Impact Radar replaces only the For You news preview. All news still opens NewsPortal. Track event saves a user's matter for later visits and across devices; it does not subscribe that user to Telegram, push or paid alerts.

The public contract in `src/shared/impactRadar.ts` deliberately has no sentiment, forecast, target or probability fields. Admission validates bounded text and known shapes, and public/storage projections discard extra properties. The text check is a conservative editorial guard, not a legal or investment-advice classification system. Source-backed publication still needs editorial judgment.

## Data and authority

`impact_radar_events` contains the current event and optional explicit date. `impact_radar_updates` stores immutable source updates. `impact_radar_follows` stores `(verified Firebase UID, event ID)` pairs. These are server-only tables: RLS is enabled, browser grants are revoked, and only service_role can use them. Server routes verify the UID independently; clients cannot choose it.

`publish_impact_radar_records` atomically publishes event metadata and source evidence. Replays are idempotent, older source batches cannot rewind a case, and a source update ID cannot move between cases or be rewritten. Editorial facts and dates survive later automated intake; new evidence still joins the timeline. A material correction must have a new update ID.

## Intake and grouping

Visible Home requests the radar at most every 60 seconds per component. Server intake is single-flight per process with a 60-second check window, bounded source records and database timeouts. Existing shared RSS fetching/cache is reused; no additional poller, cron schedule, Telegram dispatch or AI request is added. Filing intake reads the existing announcement cache and requires a valid BSE/NSE attachment, known Indian scrip and genuine exchange timestamp. Source-reported news is visibly distinguished from company disclosures and original official sources.

An exact case/appeal/petition reference including its year is grouped only within a recognized national authority and the same Indian company. Generic High Court/NCLT references lack jurisdiction/bench identity and are not automatically merged. Otherwise canonical article/filing URLs identify separate source reports. Similar headlines or the same company alone do not establish a shared legal matter. The first version intentionally does not guess case identity, court dates, final judgments, business exposure, price effects or historical analogues. Unknown future dates do not enter Today/Tomorrow/Next 7 days filters.

For a reviewed multi-day matter use `POST /api/impact-radar/admin/publish` with `{event, update}` and an authenticated admin session. Reuse its canonical `event.id`; every later source has its own `update.id` and matching `update.eventId`. The full validated event fields are defined in the shared TypeScript interface. `scheduledDate` is `YYYY-MM-DD` in IST without an invented hearing time; `scheduleConfirmed` must describe source evidence. Use `scheduled` before the event, `active` for a confirmed ongoing matter, `monitoring` while following reported developments and `closed` only when supported. A scheduled date passing never changes status automatically.

## API and client recovery

- `GET /api/impact-radar`: latest 200 open records, checked time and source-intake status. It is not a real-time quote feed or an exhaustive archive.
- `GET /api/impact-radar/:id`: event and latest 50 immutable source updates.
- `GET /api/impact-radar/following`: current user's most recent 500 followed records, including closed cases.
- `PUT /api/impact-radar/:id/follow`: `{followed: boolean}`; verified ownership, idempotent durable write, no local-only success.

All responses are private/no-store. Background arrivals queue for Show updates; old account and cancelled reads cannot replace current state. Writes update the tracking button/count/filter only after confirmation. A timeout can have an unknown server outcome, so refresh/retry reconciles the same idempotent desired state. Tracking-list read failure does not manufacture an empty confirmed list. Offline or delayed sources keep their timestamps and display recovery copy.

## Release and verification

Apply `supabase/migrations/20261016180236_impact_radar.sql` before serving the new application. Existing `SUPABASE_URL` and server-only service-role configuration are reused. Run the radar regression files, typecheck/build and map checks; test mobile/tablet/desktop themes, keyboard/focus, reduced motion, source failures and account switching with an authorized browser environment.

No speculative case or unverified research example is seeded. The first feed fills from available source data and reviewed publications. Repository delivery, SQL installation and application hosting deployment are separate release states. To roll back presentation, restore the HomeMarketNews slot; retain the durable event/follow tables and evidence.
