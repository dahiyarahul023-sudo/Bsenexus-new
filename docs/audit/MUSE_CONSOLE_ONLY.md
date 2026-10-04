# Muse: sirf browser/console operations — coding Codex karega

Rahul ka direction: source code, backend logic, frontend handlers, tests aur SQL migration files Codex likhega. Muse authorized browser login se consoles, configuration, prepared migration apply, deployment aur live verification karega. Muse se koi source-code edit, nayi SQL likhna, function redesign, command-line patch ya dependency upgrade nahi karwana hai.

Cloud publish problem Rahul ke mutabik Muse resolve kar chuka hai. Purane failed publish ko dobara investigate karna default task nahi hai. Ab current working revision preserve karke is naye batch ko safely deploy/verify karna hai.

## 1. Pehle working setup ka record

GitHub: https://github.com/dahiyarahul023-sudo/Bsenexus-new
Cloud Run: https://console.cloud.google.com/run
AI Studio: https://aistudio.google.com/
Supabase: https://supabase.com/dashboard
Firebase: https://console.firebase.google.com/
Cashfree: existing authorized merchant dashboard/session use karo; sandbox aur production ko clearly alag rakho.

1. AI Studio app ke GitHub panel me connected repository aur branch dekho. Sirf app title se repo/branch infer mat karo.
2. AI Studio Advanced settings se linked Cloud project confirm karo. Cloud Run me actual service aur region record karo. Pehle screenshots me service untitled/us-west1 thi; exact ID console se lo.
3. Current ready revision, current traffic distribution, image/build reference, publish time aur app URL record karo. Agar current source commit console me nahi milta, "unknown" likho.
4. Cloud issue me Muse ne kya setting/operation change ki aur kaunsi revision success hui, short note do. Screenshot me secret values crop/blur karo.
5. Supabase ka connected project reference confirm karo. Multiple projects hain to backend environment ke project reference se match karo; key/value chat me paste nahi karna.
6. Working revision ko rollback reference rakho. GitHub main abhi previous audit commit 2094d1b se start hua hai; is follow-up ke liye separate PR hai.

**Pass:** correct repo/branch, Cloud service, Supabase project aur working revision identified. Mismatch ho to merge/publish se pehle report karo; source editor me patch mat karo.

## 2. Database inspection — source/SQL banana nahi

1. Supabase SQL Editor kholo.
2. GitHub me docs/audit/schema-contract.sql file kholo. Ye Codex-prepared read-only inspection hai. Is ready file ko SQL Editor se run karke output collect karo; apni SQL/function body mat likho.
3. Existing payment functions ki signatures, result types, execution grants, RLS/policies aur table columns ka output do.
4. In naye objects ki existing presence Table Editor / Database Functions me dekho: ai_quota_days, ai_quota_reservations, manage_ai_quota, notifications, user_notification_receipts.
5. Agar notifications table pehle se hai, columns aur types ko migration file ke expected columns se compare karo. Incompatible type, missing columns, custom policy ya same-name function ka different contract ho to ruk kar output Codex ko do. Rename/drop/replace mat karo.
6. Database backup/PITR availability aur staging/copy project record karo. Payment/user data ko export karna zaroori ho to secure project storage me rakho; chat attachment me customer data nahi bhejna.

**Payment contract mismatch ka kaam:** actual schema output Codex ko dena. Missing 9-argument payment RPC ya wrong columns ko Muse khud code/SQL se repair nahi karega. Codex actual schema ke basis par migration taiyar karega.

## 3. Ready migrations apply — merge/deploy se pehle

GitHub PR branch se sirf ye Codex-prepared files use karo:

- supabase/migrations/002_restrict_privileged_rpcs.sql — old privileged RPC permissions ka repair, agar abhi apply nahi hua.
- supabase/migrations/003_durable_ai_quota.sql — new quota tables + service-only atomic RPC.
- supabase/migrations/004_notification_inbox_receipts.sql — missing compatible inbox table + per-user read receipts.

1. Pehle staging/copy project me file 002, phir 003, phir 004 apply karo. Har file complete transaction hai; lines ko individually edit/run mat karo.
2. Har result ko success/error + timestamp ke saath record karo. Error par same SQL ko repeatedly edit/retry mat karo; exact message Codex ko do.
3. Table Editor me new quota tables aur receipt table appear hone chahiye. Function list me manage_ai_quota dikhna chahiye. Expected RLS enabled aur browser-role access restricted hona chahiye.
4. Existing functions par 002 ke baad service-role operations chalne chahiye. Function invoker permissions ke liye existing underlying tables ka access inspect karna zaroori hai. Error aaye to broad PUBLIC grant ya SECURITY DEFINER wapas mat lagao.
5. Successful staging check aur actual production schema compatible hone ke baad wahi exact files production project me apply karo.
6. Cutover note: old local quota usage auto-import nahi hota; new database counter initially zero ho sakta hai. Old shared global read flag se per-user history reconstruct nahi hoti, isliye kuch shared records unread dobara dikh sakte hain. Purane data ko delete/backfill mat karo.
7. Applied filename, project reference aur completion time record karo. Existing migrations history system hai to usi workflow ka use karo; arbitrary migration number assume nahi karo.
8. Initial 001_initial_schema.sql ko existing live DB par re-run nahi karna. Uska old payment contract live schema ko replace kar sakta hai.

**Important:** new backend cloud/production mode me missing quota/inbox storage par 503 dega. Migrations successful hone se pehle PR merge/publish mat karo. Ye fail-closed behavior hai; local JSON ko live durable database ka substitute nahi banaya gaya.

## 4. GitHub UI merge aur AI Studio/Cloud Run publish

1. PR description me lint/build/tests pass aur migration prerequisites padho.
2. Migration results clear hone par GitHub UI se PR merge karo. Merge commit SHA record karo.
3. AI Studio GitHub integration se latest merged source sync karo. Agar integration me pull/sync operation available nahi, screenshot/status Codex ko do; generated chat edits se same changes recreate mat karo.
4. Publish/Republish ek baar chalao. Doosre tabs/agents se simultaneous publish avoid karo.
5. Cloud Run Revision History me nayi ready revision, correct source/build aur actual traffic verify karo. AI Studio ka old "Ready" badge alone evidence nahi hai.
6. Production environment me Supabase URL + service-role secret configured, JWT secret configured, Firebase Admin identity configured aur Gemini secret configured hone chahiye. Sirf presence/project association record karo.
7. Existing values ya signing secrets routine deployment ke liye rotate mat karo. Rotation required ho to affected sessions/providers ka plan Codex ko do.
8. Fresh incognito browser me app kholo; stale service-worker/cache ke saath purani UI ko nayi revision mat samjho.

**Pass:** exact merged commit linked to ready deployment and intended traffic. GitHub merge, SQL success aur Cloud Run ready teen alag evidence hain.

## 5. Live functional checks — browser se, synthetic users/data

| Test | Steps | Expected result |
|---|---|---|
| Normal login | Test account se sign in, refresh, profile kholo | Valid profile; auth/storage error par fake successful session nahi |
| Revoked Firebase identity | Staging Firebase test user ki session revoke/disable console se karo, phir us purane Firebase session se protected action | Rejected/re-authentication. Server-issued 7-day JWT revocation abhi separate pending gap hai; is test ko uska proof mat bolo |
| Quota persistence | Active Pro test user ka quota count dekho, ek summary request karo, page refresh/different browser me same user ka count dekho | Same daily count; failed request ka refund once-only |
| Quota restart | Staging service ko existing image se new revision/restart karo; same user ka count dobara dekho | Database count retained. Production ko sirf testing ke liye restart nahi karna |
| Quota outage | Staging me prepared outage scenario/known store failure par request karo | Retryable failure; local fake generation-success/extra quota nahi |
| Shared notification receipts | A aur B test users ke inbox me same shared test notification; A read kare, B refresh kare | A read, B unread; private notification doosre user ko nahi dikhe |
| Inbox restart | Staging test inbox record save, staging revision restart, inbox reopen | Record remains; read state remains. Backend write failure logs observable |
| Clear inbox | A personal inbox clear kare, B/shared inbox dekho | A personal records clear; B/shared records remain |
| Inspect | Admin Diagnostics me captured synthetic crash ka Inspect button click | Existing error-details modal opens; message/device/trace visible; close works |
| Watchlist | Own list rename/toggle, stale/deleted list action repeat | Own action succeeds; missing/foreign list fails instead of false success |
| Filtered filings | Different symbol filters aur limits jaldi switch karo | Har response correct filter/limit ka; pehle filter ka cached result leak nahi |
| New filing freshness | Genuine new exchange filing ki publication/fetch/API/display times record karo | Backend insert old feed cache invalidate kare; latency measured, instant promise nahi |
| Source outage | Provider failure logs ke time quotes/feed inspect karo | Cached/stale/unavailable state visible; refresh attempt old quote ko new timestamp nahi banata |
| Heuristic summary | Staging me Gemini unavailable/missing key scenario ki summary inspect karo | Explicit heuristic label and headline-only evidence; full PDF analyzed claim nahi |
| Story close boundary | Trading-day 15:00/15:29/15:30 IST editions inspect karo | Closing edition 15:30 se; pre-open ko regular trading hours nahi |
| Pricing/login/note | Guest chooses plan; actual sign-in return; filing deep link Save Note | Selected plan correct; URL identity retained; note durable save/error honest |

Multi-instance concurrency load, manufactured payment, metadata/internal URL attacks aur real customer token replay browser se ad-hoc production par nahi karna. Codex ka isolated proof alag hai; live completion ke liye authorized staging scope use karo.

## 6. Cashfree, Firebase aur Telegram console checks

**Cashfree:** sandbox mode confirm; configured return URL/domain aur webhook URL production/staging se match; webhook delivery log me successful test event, retries aur HTTP status record. Test order me amount/currency/plan aur access expiry match. Duplicate sandbox delivery once-only extension honi chahiye. Real charge/refund nahi karna. Unexpected entitlement aaye to timestamp/order reference Codex ko do; DB row manually Pro mat karna.

**Firebase:** authorized domains me intended app domain; enabled sign-in provider; configured Admin identity correct project. App Check/reCAPTCHA console configuration inspect karo, enforcement blindly enable mat karo—backend/client rollout aur allowed domains ka decision pending hai.

**Telegram:** correct bot/shared destination and saved personal destination inspect karo, test delivery verify karo. Delivery ko chat ownership proof mat bolo. Bot challenge/binding code pending hai; arbitrary user's chat ID/link public report me nahi likhna.

**Dependencies/CSP:** Muse environment/Node/package-manager metadata collect karega. Dependency versions, CSP rules, admin PIN enforcement ya token lifetime browser/editor se change nahi karega.

## 7. Device and UI checks

Real Android Chrome, iPhone Safari, iPad portrait/landscape aur desktop browsers jo available hain unke model/OS/browser version record karo. 320px width, short landscape, 200% zoom, keyboard open, long text, empty feed, failed network, loading state aur modal close/Back navigation test karo.

Footer/button kisi fixed bottom bar ke neeche ho, Tap target hidden ho, Inspect modal clipped ho ya selected pricing plan lose ho to URL + role + device + expected/actual + screenshot do. Source CSS/JS patch Codex karega.

Previous audit ke 243 emulated scenes aur 24 targeted checks purane batch ke evidence hain. Is follow-up me local browser binary startup crash hua; nayi UI ko fresh browser-verified mark nahi kiya gaya.

## 8. Agar kuch fail ho

- Schema mismatch: exact columns/function definition export; Codex migration banayega.
- Missing RPC/table 503: migration/project reference mismatch check; local fallback enable mat karo.
- Permission denied: exact principal/operation/grant evidence; blanket Owner/PUBLIC role mat do.
- Publish failure: sirf new attempt ke logs/revision dekho. Purane fixed incident ko current cause mat maanna. Same unchanged failure ke do retries ke baad evidence collect karo.
- Wrong deployed code: source commit/editor sync/image record; app code recreate nahi karna.
- New revision runtime regression: working old revision par traffic rollback; additive migration tables ko delete nahi karna. Secrets/DB data reset nahi karna.
- Billing upgrade ya policy decision required: pending list me rakho; Rahul jawab dega.

## 9. Muse ka final return format

Har item ke liye: site/project, action, timestamp IST, result, evidence link/sanitized screenshot, blocker, next owner. Saath me merged commit SHA, deployed revision/traffic, applied migration filenames, sandbox payment result aur device test list.

End status clear rakho: DONE / FAILED / NOT TESTED / RAHUL DECISION PENDING. Code push ko deployment aur delivered Telegram message ko identity verification mat likho.
