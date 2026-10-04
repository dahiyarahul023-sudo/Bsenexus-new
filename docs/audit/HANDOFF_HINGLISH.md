> Superseded for current Muse tasks by [MUSE_CONSOLE_ONLY.md](MUSE_CONSOLE_ONLY.md). Cloud incident resolved per Rahul. Muse should not write code; old investigation/test design below is historical context.

# Rahul ke liye audit handoff aur Muse/browser agent ka kaam

Repo: dahiyarahul023-sudo/Bsenexus-new. Baseline main commit 55d35a16a0a0b09017f685af4f4170acc2d30b3e. Isi repo ko audit kiya hai; saari GitHub repositories ka audit nahi hua.

## Pehle kya samajhna hai

Firebase login/identity sambhalta hai. Supabase current server data, profiles, notes aur payment ledger ka important hissa hai. Cloud Run app ka backend/container chala raha hai. AI Studio publish us Cloud Run service ko update karta hai. GitHub push, Supabase migration aur Cloud Run republish teen alag operations hain. Ek successful hone se baaki automatically verified nahi hote.

Report me 44 records hain: kuch reproducible bugs, kuch code se confirmed gaps, kuch abhi reproduce na hue race risks aur kuch live-check pending items. Har record ka status padho. Code fixed ka matlab live fixed nahi. Full source inventory/count bana hai; har line ka manual logic proof aur har button ka real-user click test complete nahi hai.

## Priority order

1. **SEC-01:** Supabase privileged RPC permissions. Local PostgreSQL me original SQL ke saath anonymous unpaid entitlement grant hua; repair ke saath permission denied. Live project me pehle definitions/permissions read karo. Existing DB me initial schema ko dobara paste mat karo.
2. **SEC-02/03/04/05:** Guest SEO, unsafe server URL/PDF redirects, shared Telegram dispatch. Source patches deploy karke anonymous/ordinary/Pro/admin denial checks karo.
3. **PAY-01:** Actual database schema vs backend contract. Payment success ke baad access milne ka actual evidence lo; Git migration missing RPCs/columns ko explain nahi karti.
4. **SEC-07, PAY-02, DATA-08/09:** Distributed quotas, entitlement repair race, notification durability aur per-user unread receipts.
5. **UX/data:** Filing deep links, actual selected checkout, note login/save, genuine/stale/unavailable data. Price/filing/story examples ko live truth mat dikhana.
6. **Device/performance:** Real Safari/iPhone/iPad, short/landscape viewport, keyboard, poor network, source-to-screen timings.

## Muse ko dene wala working brief

“Latest main checkout aur docs/audit report padho. Pehle exact baseline/current Git head record karo. Mujhse subah wale decisions ko pending register me rakho; read-only investigation aur already authorized safe fixes continue karo. Current working Cloud Run service ko delete/unpublish mat karo. Genuine data, paid entitlement, billing aur credentials ko bina verified evidence change mat karo. Har change ke liye source, symptom, root cause, test result, deployment status aur rollback likho. Private secrets ko chat/report/screenshot me mat dikhana. Browser ka authorized login use karo; tokens/password export karke mujhe bhejne ki zarurat nahi.”

### Browser se current publish error ka investigation

1. AI Studio app, uska GitHub-linked repo/branch, app URL aur Advanced settings me linked Cloud project ko record karo. Screenshot me working service **untitled**, region **us-west1**, project roughly **groovy-coda-l9v0l** dikh raha tha; exact project ID browser se confirm karna. Sirf naam Bse-nexus wale empty project ko dekh kar service missing mat maanna.
2. Last success screenshot me **Oct 3, 2026, 10:15:17 PM IST** hai. Service revision history me latest ready revision, latest created revision, traffic percentage, image digest/build reference, deployment time, reconciliation status aur error message dekho. Current deployed source Git main se older ho sakta hai.
3. Ab jo publish fail hota hai us attempt ka exact time/timezone aur toast text record karo. Ek controlled attempt enough hai; parallel tabs/agents se publish mat chalao. Pehle se update in progress ho to uska outcome dekho.
4. [Shared Cloud Logging link](https://cloudlogging.app.goo.gl/GxVtoJaMGmvSDwty8) authorized browser me khol sakte ho. Time range ko actual new attempt ke around rakho. Severity ko start me all levels rakho; sirf ERROR filter causes/status details chhupa sakta hai.
5. Revision logs ka basic filter:

```text
resource.type="cloud_run_revision"
resource.labels.service_name="untitled"
resource.labels.location="us-west1"
```

6. Deployment API/audit events alag query me dekho; revision filter ke andar UpdateService event miss ho sakta hai:

```text
protoPayload.serviceName="run.googleapis.com"
protoPayload.methodName="google.cloud.run.v2.Services.UpdateService"
```

Actual resourceName/project/service aur timestamp add karo. Operation ID, status.code/status.message, request resource version/etag, current version aur actor service-account name record karo; credentials nahi.
7. Visible purana conflict log around **19:55 IST** ka tha, jo 22:15 ke successful publish se pehle tha. Isliye usse later publish failure ka final cause mat maanna. Naye attempt se match hona zaroori hai.
8. Logs se cause mile to neeche wale matching branch par kaam karo. Har change ke baad ek retry aur uska timestamp/result record karo. Same unchanged retry 2 baar fail ho to blind retry band karke fresh log evidence lo. Ye retry budget troubleshooting rule hai, provider guarantee nahi.

| Naya actual evidence | Kya karna hai | Kya verify karna hai |
|---|---|---|
| Resource version / etag conflict | Doosre writers/deployments ko stop, update complete hone do, AI Studio reload/reopen se current service metadata lo, phir ek retry | Naya operation current generation/version use karta hai; successful ready revision aur traffic |
| Permission denied / IAM | Log me exact principal aur denied permission identify; existing service/project identity aur required narrow role inspect | Authorized publisher required operation kar saka; arbitrary Owner role dene ki zarurat nahi |
| Starter tier / billing / quota / API error | Exact quota, project tier/billing linkage, enabled API aur region constraint inspect | Error code ka specific prerequisite resolve hua; billing upgrades/cost decisions subah decision register me |
| Build/package error | Latest Cloud Build output, lockfile, Node version, npm install/build error line | Repo-local lint/tests/build pass; same build command image me pass |
| Container startup/health failure | Revision container logs, crash stack, port/listen address, required env presence | Server 0.0.0.0:$PORT par start aur revision ready; secrets ke sirf names/presence record |
| Supabase missing column/function | schema-contract.sql read-only export aur DAO contract compare | Exact 9-arg payment RPC/returns, ledger fields and table grants match; test-copy migration pehle |
| 503 request after a successful deployment | Request route, response, source/dependency health aur stack correlate | Runtime error ko deployment UpdateService conflict se alag classify |
| RSS providers error | ET/Mint/Moneycontrol/BS response status, TLS/timeout/rate limits/circuit breaker | Genuine cached data age aur unavailable state; news failure puri filing feed ko block nahi karta |

Unpublish, service delete, region/project switch, billing upgrade, force push ya table reset root-cause investigation ka default fix nahi hai. Existing working revision rollback ke liye preserve karo. Successful build ke baad bhi publish succeed hone ka evidence chahiye.

### Supabase browser checklist

1. Actual connected project URL/reference confirm. Browser Network me backend ka project client config/service credentials expose mat karna.
2. SQL Editor me **docs/audit/schema-contract.sql** run karo: ye read-only hai. RPC definitions/args, anon/authenticated/service-role EXECUTE, RLS/policies aur columns export karo.
3. SEC-01 ke privileged functions par anon/authenticated execution false hona chahiye. RLS-only check enough nahi. Existing overloads bhi check karo.
4. 002 migration review ke baad owner se apply hoti hai. Isme missing payment RPC bodies ya columns create nahi hote. Custom deployed functions invoker hone ke baad service-role grants ke saath chalne chahiye; copy/staging me verify karo.
5. Backend expects: payment_orders me email, updated_at, granted_at, paid_at, pro_expires_at, grant_source, last_error; milliseconds timestamps; lowercase state machine. Entitlements me pro_expires_at/pro_plan_id/last_payment_at/granted_order_ids/updated_at/source. Initial schema ke columns alag hain.
6. Backend 9-arg grant_payment_atomic plus record_pending_order_atomic, claim_order_for_grant, claim_free_summary_demo use karta hai. Actual DB me manual additions hon to unhe preserve/version-control karo. DB export dekhe bina old schema se replace mat karo.
7. notifications/auth_account_limits aur user/announcement fields bhi compare. Note writes cloud-first hain; notification writes swallowed failure ke saath local-only ho sakti hain.
8. Copy/staging me A/B synthetic users, concurrent grant/repair, webhook retry, store outage aur restart test karo. Real customer data par unpaid grant experiment mat karo.

### Subscription abuse test matrix — sandbox/staging

* Guest/expired user direct protected API call: denied; paid UI localStorage edit alone should not grant backend access.
* A pays order, B attempts verify/recover/claim: rejected; amount/currency/plan/status mismatch: no grant.
* Duplicate paid webhook + simultaneous browser verify: once-only extension, same already-granted result.
* Crash after pending record / during grant: retry recovers without double extension.
* Supabase down: retryable failure; user ko local fake success nahi.
* Expired paid user: renewal flow, no misleading second trial; existing active expiry extends correctly.
* Replayed pre-logout token/admin owner raw Firebase token: current open gaps ko reproduce safely, next design se expected denial define.
* Quota last unit with 100+ parallel requests, then two replicas and restart: process-only success ko distributed proof mat kehna.
* Telegram stored wrong/shared chat: shared blocked; independent ownership binding abhi pending.

### Button and device checks

Each action ko label → handler → API → auth gate → DAO/external call → visible success/error ke through trace karo. Sirf button render hona ya HTTP 200 aana completion proof nahi. Unknown-ID rename/toggle false success, Inspect placeholder aur deep-sync completion/progress still need separate work.

Already tested 243 emulated Chromium scenes: guest/Pro/admin × 9 routes × 9 widths. 24 extra scenes me pricing selection, Save Note/sign-in and bottom-scroll controls operate kiye. No horizontal document overflow/JS exception in initial matrix. Ye real Safari/iPhone/iPad certification nahi. Real iOS Safari, Android Chrome, desktop Firefox/Edge/Safari, iPad portrait/landscape, 320px, 200% zoom, software keyboard, safe-area, focus/Escape/Tab, screen reader, modal nesting, slow/failed network, long titles, empty data and unavailable source test karo. Device model/OS/browser version record karo.

Pricing: guest paid plan select → login; logged-in select → selected checkout. Real Cashfree sandbox click/payment and sign-in return abhi pending. Filing: direct/refresh/login/back-forward URL same identity; Save Note guest → login, logged-in → note editor, cloud failure → draft retained, no fake saved toast.

## Subah ke pending decisions/questions

| Decision | Kyun important |
|---|---|
| Exact canonical production domain and intended Cloud project/service? | bsenexus.in vs AI Studio URL redirects/deployed source ownership |
| Main production branch aur AI Studio editor sync rule? | Git push aur editor republish same source ki guarantee nahi |
| Actual Supabase schema/functions me manual SQL changes hain? | Additive migration/backfill actual state se banegi |
| PIN genuine mandatory second factor hona chahiye ya UI lock? | Current owner token already admin hai |
| Subscription/trial limits: stock/list quota, AI budget, 7-day eligibility, renewal/refund? | Backend, copy aur billing contract consistent chahiye |
| Personal Telegram chat ownership aur shared channel admin list? | Arbitrary typed chat ID ownership proof nahi |
| Live stage-to-stage filing latency target? | Instant/fastest claim ko measurement chahiye |
| Which dataset is illustrative/demo and which must be genuine/live? | Landing narratives and all dynamic data provenance |
| Notification retention/unread per-user behavior? | Shared read state aur ephemeral persistence fix design |
| Chosen package manager npm or bun and supported Node version? | Two lockfiles and compatible dependency patch policy |
| Safari/iPhone/iPad devices available for real tests? | Emulation se engine/device quirks prove nahi hote |
| Staging test project/sandbox credentials and allowable production probe scope? | Next attacks and real billing/restart validation safely isolate hongi |

Secrets/passwords in chat mat bhejna. Authorized browser/cloud session ya environment secret mechanism use karo. Final result me commit, build/test counts, deployed revision, migration version, pending findings and rollback reference alag-alag likho.
