# Impact Radar: permanent history and archive operations

## Contract

- Cases and evidence have **no automatic expiry**. The seven-day source-check ledger is operational health, not case history. The live intake discovery window remains seven days.
- Exact company alone never identifies a case. V2 auto-joining requires a typed civil/criminal appeal or writ petition number/year at the Supreme Court of India. Generic references, tribunal benches, uncertain proceedings and re-used URLs stay separate provisional records. An administrator may explicitly append source-backed updates through the existing `/api/impact-radar/admin/publish` route. New appeals get separate IDs, not a continuation guessed from a company name.
- Existing evidence IDs map back to their existing case IDs, including follows. Conflicting legacy groups are not merged. This does not retroactively certify or split older grouped evidence: review original sources first.
- `first_public_at` is the earliest **recorded** public timestamp, not a claim of the first report anywhere. Older evidence can move it earlier; newer updates cannot move it later.
- History is a permanent compact event/search index. `/history` uses `(first_public_at,id)` keyset paging (25 items); `/:id/timeline` pages immutable source updates (50 items), including verified archived evidence. Feed limits do not define retention. IST date filters include the complete selected last day.

## Observed research, not predicted impact

`impact_price_sessions` retains selected official exchange closes/source links. The existing price worker also records proven open market days. Source-reviewed closures may be supplied by an administrator through `POST /api/impact-radar/admin/research/calendar` with `{days:[{date,exchange,open,sourceUrl}]}`. Only official NSE/BSE domains are accepted; the operator must verify the source actually supports each date. Existing calendar facts are not overwritten. Missing or failed reports are never treated as holidays.

The maintenance queue computes four records every 15 minutes, ordered by least-recently checked, without the feed's 200-case cap. `/:id/research` serves durable observations. `POST /admin/research/:id` refreshes a specific record; `{capture:true}` attempts **one** missing past report date through the existing bounded exchange loader. It does not turn unavailable reports into closures or scrape an unlimited history. A poisoned or unavailable historical date requires source review, not invented data.

Policy v1 uses the earliest recorded publication, starts after-close reports on the next confirmed open session and records raw closing changes at sessions +1/+3/+5/+20 against the first session's official previous close. During-session reporting overlaps that day's trading. A calendar gap stops session counting; a known session with missing price stays missing. A genuine observed zero stays zero. Corporate actions and concurrent news remain unreviewed; benchmark is explicitly unavailable. No causal attribution, adjusted/excess-return claim, strong/no-reaction cohort or forecast is manufactured. All material cases are retained independently of price direction, including limited movement and unknown outcomes.

**Remaining dataset gates:** approved historical source acquisition, independently verified closed-day calendar, benchmark/corporate-action review and research cohort classification are not supplied by this migration. Two years of complete history is not claimed. Historical cases can already be entered in bounded reviewed batches through the source-backed administrator publisher; they do not dispatch live filing alerts. Pilot and inspect provenance before scaling.

## Private archive safety

Apply `20261022042548_radar_history_archive.sql` before deploying the server changes. It creates the private `radar-history` bucket, service-only indexes/metadata and immutable update-key tombstones. No bucket policy grants browser access. Core cases, summaries, first-public timestamp, follows, daily price evidence and update identities stay in Postgres permanently.

Maintenance checks at most two closed cases per day whose last update is older than 24 calendar months. Active cases remain hot regardless of age. A distributed ten-minute lease prevents concurrent workers archiving one case. Expired leases recover after process failure. Verified-primary timestamps provide a durable daily cooldown across instances.

1. Snapshot the complete case timeline (maximum 5,000 updates; larger cases must be partitioned, never silently truncated), first-public time and current research evidence. Exclude account IDs/follows/OAuth and non-whitelisted payload fields.
2. Compress to gzip, maximum 8 MiB compressed / 32 MB decoded. Upload without overwrite to `<event-id>/<sha256>.json.gz` in the private bucket. Full download, checksum, decompression, case identity and count checks prove the primary copy can be restored.
3. If the independently configured Drive backup exists, upload the same bytes and fully download/decode/check them too. The dedicated OAuth grant only creates files in the configured folder; no public-sharing action is performed. It does not reuse Firebase or a ChatGPT connector token. Multipart backups over 5 MB stop safely for partitioning.
4. Only after both verified copies does the transactional compaction RPC recheck closed status, 24-month age, event version and the exact current update count/content digest under a row lock. Any concurrent change or failure retains all originals. Successful compaction removes only hot **update bodies**, not cases, follows, price history or permanent immutable update keys. Replayed archived evidence cannot rewrite the case.
5. Details read the archived timeline plus any later hot updates, deduplicated by immutable ID. One compacted file per case is supported; reopened cases keep later updates hot. Corrupt/unavailable files return an explicit unavailable state, never an empty successful timeline. The first recorded source remains in compact metadata.

`POST /api/impact-radar/admin/archive/:id` verifies copies without compaction. It returns `primary-verified-backup-pending` when there is no independent connection, not “backed up”. No current case should be deleted merely to exercise this feature. To recover after primary object loss, restore the verified identical Drive bytes to the same private path; the original manifest hash must still match. Whole-database disaster recovery requires restoring the event index and immutable keys from a database backup as well; compressed evidence files are not a replacement for database backups.

## Server-only configuration and capacity

Use existing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. Dedicated independent backup variables are `RADAR_DRIVE_CLIENT_ID`, `RADAR_DRIVE_CLIENT_SECRET`, `RADAR_DRIVE_REFRESH_TOKEN`, `RADAR_DRIVE_FOLDER_ID`. Store them in the hosting secret manager, never frontend/env examples with values or logs. Use an authorized offline `drive.file` grant and a folder accessible to that grant. Do not enable R2, paid billing or broad access as a workaround for missing credentials.

`GET /api/impact-radar/admin/storage` shows measured DB bytes, Radar table/index bytes, all storage-object bytes, unknown object sizes and case/update counts, plus whether dedicated backup configuration is present. These are operational sizes, not billing/dashboard quota guarantees. `RADAR_ARCHIVE_BUDGET_BYTES` defaults to an internal conservative 750 MiB file budget, **not** a promise about any provider's free tier. An unreadable budget, unknown file sizes, or a file exceeding this budget blocks archive upload and leaves original history untouched. Existing announcements occupy most database space; moving small Radar records does not solve unrelated ingestion growth.

Postgres can reuse space from compacted rows without immediately shrinking its allocated database files. Do not promise an immediate reduction in billed/dashboard size or run a blocking table rewrite as part of this job; measure growth and normal vacuum/reuse separately.

The existing authenticated external cron, boot and watchdog run maintenance after intake/prices. Request-based hosting still needs its external scheduler. No new paid services, browser-triggered ingestion, alert dispatch or R2 integration are introduced.

## Release checks and rollback

Rehearse migration on staging, test RLS/anonymous denial, first-public monotonicity, >200-record paging, archive readback corruption, missing prices, lease contention, concurrent mutation and compaction gates. Production schema application, code merge, actual hosting publication and real private object/Drive readback are distinct gates. Roll server code back without dropping the additive schema or archive metadata. Never roll back by deleting retained cases, tombstones, files or follows.
